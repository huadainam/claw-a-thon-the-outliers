import re
from difflib import SequenceMatcher
from models import MATCH_THRESHOLD, AMBIGUOUS_THRESHOLD

def _lead_name(title: str) -> str:
    """The main app name before a separator, e.g. 'Zalopay' from
    'Zalopay-Thanh toán & Tài chính'. App Store/Play titles often append a long
    tagline that wrecks naive full-title similarity."""
    return re.split(r"[-–—:|(]", title, 1)[0].strip()

def _sim(query: str, title: str) -> float:
    """Score how well `query` matches an app `title`. Compares against both the
    full title and its leading name segment, and boosts prefix/substring hits so
    long official titles aren't unfairly penalized."""
    q = query.lower().strip()
    t = title.lower().strip()
    lead = _lead_name(title).lower().strip()
    if q == t or q == lead:
        return 1.0
    if t.startswith(q) or lead.startswith(q):
        return 0.95
    if q in t:
        return 0.9
    return max(
        SequenceMatcher(None, q, t).ratio(),
        SequenceMatcher(None, q, lead).ratio(),
    )

def _merge_candidates(query, gp_list, as_list):
    """Merge per-store candidates by title similarity into unified app dicts."""
    merged = {}  # normalized title -> app dict
    for store_list in (gp_list, as_list):
        for c in store_list:
            key = c["title"].lower()
            app = merged.setdefault(key, {
                "title": c["title"], "developer": c.get("developer", ""),
                "icon": c.get("icon", ""), "gp_id": None, "as_id": None, "stores": [],
            })
            if c["store"] == "google_play":
                app["gp_id"] = c["app_id"]
                if "google_play" not in app["stores"]:
                    app["stores"].append("google_play")
            else:
                app["as_id"] = c["app_id"]
                if "app_store" not in app["stores"]:
                    app["stores"].append("app_store")
    scored = [(_sim(query, app["title"]), app) for app in merged.values()]
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored

def resolve_app(name, gp_search=None, as_search=None):
    if gp_search is None or as_search is None:
        from scraper_live import gp_search_live, as_search_live
        gp_search = gp_search or gp_search_live
        as_search = as_search or as_search_live

    gp_list = gp_search(name)
    as_list = as_search(name)
    scored = _merge_candidates(name, gp_list, as_list)

    if not scored:
        return {"status": "not_found",
                "message": f"Không tìm thấy app '{name}'. Thử nhập tên khác."}

    top_score, top_app = scored[0]
    if top_score >= MATCH_THRESHOLD:
        return {"status": "matched", "app": top_app}

    suggestions = [app for score, app in scored if score >= AMBIGUOUS_THRESHOLD][:5]
    if suggestions:
        return {"status": "ambiguous",
                "message": f"Không tìm thấy chính xác '{name}'. Có phải ý bạn là...",
                "suggestions": suggestions}

    return {"status": "not_found",
            "message": f"Không tìm thấy app '{name}'.",
            "suggestions": [app for _, app in scored[:5]]}

def scrape_google_play(app_id, count=1000, fetch=None):
    if not app_id:
        return []
    if fetch is None:
        from scraper_live import gp_reviews_live as fetch
    try:
        raw = fetch(app_id, count)
    except Exception:
        return []
    out = []
    for r in raw:
        out.append({
            "id": str(r.get("reviewId")),
            "userName": r.get("userName", ""),
            "content": r.get("content", "") or "",
            "score": r.get("score", 0),
            "at": str(r.get("at", "")),
            "source": "google_play",
        })
    return out

def scrape_app_store(app_id, count=1000, fetch=None):
    if not app_id:
        return []
    if fetch is None:
        from scraper_live import as_reviews_live as fetch
    try:
        raw = fetch(app_id, count)
    except Exception:
        return []
    out = []
    for r in raw:
        out.append({
            "id": str(r.get("review_id") or r.get("id")),
            "userName": r.get("user_name", ""),
            "content": r.get("review", "") or "",
            "score": r.get("rating", 0),
            "at": str(r.get("date", "")),
            "source": "app_store",
        })
    return out
