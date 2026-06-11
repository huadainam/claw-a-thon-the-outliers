from difflib import SequenceMatcher
from models import MATCH_THRESHOLD, AMBIGUOUS_THRESHOLD

def _sim(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

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
