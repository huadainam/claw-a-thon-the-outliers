import threading
from datetime import datetime, timezone
from grouper import group_bugs, merge_with_existing_todos

_run_lock = threading.Lock()
BATCH_SIZE = 30

def _now():
    return datetime.now(timezone.utc).isoformat()

def _regroup(store, canonicalize_fn):
    """Canonicalize bug topics, group, and merge with existing todos (preserving
    status). Canonicalization clusters varied free-text topics so mentions add up."""
    reviews = store.load_reviews()
    existing = store.load_todos()
    raw_topics = sorted({(r.get("bug_topic") or "").strip() for r in reviews
                         if r.get("label") == "BUG_REPORT" and r.get("bug_topic")})
    preferred = [t["topic"] for t in existing]
    topic_map = canonicalize_fn(raw_topics, preferred) if raw_topics else {}
    groups = group_bugs(reviews, topic_map=topic_map)
    todos = merge_with_existing_todos(groups, existing)
    store.save_todos(todos)
    return todos

def _run_summary(requested_reviews=0, crawled_reviews=0, new_reviews=0,
                 classified_reviews=0, total_reviews=0, used_fallback=False,
                 error=None):
    summary = {
        "requested_reviews": requested_reviews or 0,
        "crawled_reviews": crawled_reviews,
        "new_reviews": new_reviews,
        "classified_reviews": classified_reviews,
        "total_reviews": total_reviews,
        "used_fallback": bool(used_fallback),
    }
    if error:
        summary["error"] = str(error)
    return summary

def run_pipeline(store=None, scrape_gp=None, scrape_as=None, classify=None,
                 review_limit=None,
                 canonicalize_fn=None, batch_size=BATCH_SIZE):
    # default wiring (production)
    if store is None:
        from storage import get_store, get_registry
        store = get_store(get_registry().get_active())
    if scrape_gp is None or scrape_as is None:
        from scraper import scrape_google_play, scrape_app_store
        from config import get_config
        # Per-run review_limit lets scheduled refreshes fetch a smaller latest
        # slice, while initial/user-triggered crawls still use the app's setting.
        cfg_for_limit = store.load_config() or {}
        limit = review_limit if review_limit is not None else (
            cfg_for_limit.get("review_limit") or get_config().review_limit
        )
        limit = int(limit)
        scrape_gp = scrape_gp or (lambda app_id: scrape_google_play(app_id, count=limit))
        scrape_as = scrape_as or (lambda app_id: scrape_app_store(app_id, count=limit))
    if classify is None:
        from classifier import classify_reviews
        classify = classify_reviews
    if canonicalize_fn is None:
        from canonicalize import canonicalize_topics
        canonicalize_fn = lambda topics, preferred: canonicalize_topics(topics, preferred=preferred)

    if not _run_lock.acquire(blocking=False):
        return {"skipped": True, "reason": "already running"}
    requested_reviews = 0
    crawled_count = 0
    new_count = 0
    classified_count = 0
    used_fallback = False
    try:
        cfg = store.load_config()
        if not cfg:
            return {"error": "no app configured"}
        requested_reviews = int(review_limit if review_limit is not None else cfg.get("review_limit") or 0)

        scraped = scrape_gp(cfg.get("gp_id")) + scrape_as(cfg.get("as_id"))
        crawled_count = len(scraped)
        used_fallback = not scraped  # regroup from cached reviews only

        processed = store.load_processed_ids()
        new_reviews = [r for r in scraped if r["id"] not in processed]
        new_count = len(new_reviews)

        meta = {"status": "analyzing", "progress": {"done": 0, "total": new_count},
                "last_updated": _now(),
                "last_run": _run_summary(requested_reviews, crawled_count, new_count,
                                         0, len(store.load_reviews()), used_fallback)}
        store.save_meta(meta)

        if new_count == 0 and not used_fallback:
            todos = store.load_todos()
            store.save_meta({"status": "idle", "progress": {"done": 0, "total": 0},
                             "last_updated": _now(),
                             "last_run": _run_summary(requested_reviews, crawled_count, 0,
                                                      0, len(store.load_reviews()), False)})
            return {"new_reviews": 0, "todos": len(todos), "used_fallback": False}

        # Classify in batches so the review count + progress bar advance live.
        for i in range(0, new_count, batch_size):
            chunk = new_reviews[i:i + batch_size]
            classified = classify(chunk)
            store.append_reviews(classified)
            classified_count += len(classified)
            processed |= {r["id"] for r in classified}
            store.save_processed_ids(processed)
            meta["progress"]["done"] = classified_count
            meta["last_updated"] = _now()
            meta["last_run"] = _run_summary(requested_reviews, crawled_count, new_count,
                                            classified_count, len(store.load_reviews()),
                                            used_fallback)
            store.save_meta(meta)

        # Canonicalize + group once at the end (correct clustering, one LLM call).
        todos = _regroup(store, canonicalize_fn)
        store.save_meta({"status": "idle", "progress": {"done": classified_count, "total": new_count},
                         "last_updated": _now(),
                         "last_run": _run_summary(requested_reviews, crawled_count, new_count,
                                                  classified_count, len(store.load_reviews()),
                                                  used_fallback)})

        return {"new_reviews": new_count, "todos": len(todos), "used_fallback": used_fallback}
    except Exception as exc:
        # A failed LLM/API call used to leave meta.status="analyzing", which made
        # the UI polling screen look stuck forever. Keep any partial reviews that
        # were already appended, but release the app back to idle with an error.
        try:
            current = store.load_meta() or {}
            store.save_meta({
                "status": "idle",
                "progress": current.get("progress", {"done": 0, "total": 0}),
                "last_updated": _now(),
                "last_run": _run_summary(requested_reviews, crawled_count, new_count,
                                         classified_count, len(store.load_reviews()),
                                         used_fallback, error=exc),
                "error": str(exc),
            })
        except Exception:
            pass
        return {"error": str(exc), "used_fallback": False}
    finally:
        _run_lock.release()

if __name__ == "__main__":
    import argparse
    from storage import get_store, get_registry
    from scraper import resolve_app
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", help="resolve+track this app then run once")
    args = parser.parse_args()
    reg = get_registry()
    if args.app:
        res = resolve_app(args.app)
        if res["status"] != "matched":
            print(f"Resolve status: {res['status']} — {res.get('message','')}")
            for s in res.get("suggestions", []):
                print("  -", s["title"], s.get("developer", ""))
            raise SystemExit(1)
        app_id = reg.upsert_app(res["app"])
        store = get_store(app_id)
        store.save_config(reg.get_app(app_id))
        print(run_pipeline(store=store))
    else:
        store = get_store(reg.get_active())
        print(run_pipeline(store=store))
