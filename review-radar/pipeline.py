import threading
from grouper import group_bugs, merge_with_existing_todos

_run_lock = threading.Lock()

def run_pipeline(store=None, scrape_gp=None, scrape_as=None, classify=None):
    # default wiring (production)
    if store is None:
        from storage import get_store
        store = get_store()
    if scrape_gp is None or scrape_as is None:
        from scraper import scrape_google_play, scrape_app_store
        scrape_gp = scrape_gp or (lambda app_id: scrape_google_play(app_id))
        scrape_as = scrape_as or (lambda app_id: scrape_app_store(app_id))
    if classify is None:
        from classifier import classify_reviews
        classify = classify_reviews

    if not _run_lock.acquire(blocking=False):
        return {"skipped": True, "reason": "already running"}
    try:
        cfg = store.load_config()
        if not cfg:
            return {"error": "no app configured"}

        scraped = scrape_gp(cfg.get("gp_id")) + scrape_as(cfg.get("as_id"))
        used_fallback = False
        if not scraped:
            used_fallback = True  # regroup from cached reviews only

        processed = store.load_processed_ids()
        new_reviews = [r for r in scraped if r["id"] not in processed]

        if new_reviews:
            classified = classify(new_reviews)
            store.append_reviews(classified)
            store.save_processed_ids(processed | {r["id"] for r in classified})

        all_reviews = store.load_reviews()
        groups = group_bugs(all_reviews)
        todos = merge_with_existing_todos(groups, store.load_todos())
        store.save_todos(todos)

        return {"new_reviews": len(new_reviews), "todos": len(todos),
                "used_fallback": used_fallback}
    finally:
        _run_lock.release()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", help="resolve+track this app then run once")
    args = parser.parse_args()
    from storage import get_store
    store = get_store()
    if args.app:
        from scraper import resolve_app
        res = resolve_app(args.app)
        if res["status"] != "matched":
            print(f"Resolve status: {res['status']} — {res.get('message','')}")
            for s in res.get("suggestions", []):
                print("  -", s["title"], s.get("developer", ""))
            raise SystemExit(1)
        store.reset()
        store.save_config(res["app"])
    print(run_pipeline(store=store))
