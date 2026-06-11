import time
import requests
from google_play_scraper import search as gp_search_fn, reviews, Sort

def gp_search_live(name):
    # google-play-scraper's search() can raise (e.g. TypeError) on no-result or
    # gibberish queries, and sometimes returns the top/featured hit with appId=None.
    # Return [] on any failure and skip candidates without a usable appId so we
    # never crash resolution or tag the google_play store with a null id.
    try:
        results = gp_search_fn(name, lang="vi", country="vn", n_hits=5)
    except Exception:
        return []
    return [{"title": r["title"], "developer": r.get("developer", ""),
             "icon": r.get("icon", ""), "app_id": r["appId"],
             "store": "google_play"} for r in results if r.get("appId")]

def gp_reviews_live(app_id, count, attempts=3):
    # Google Play throttles rapid back-to-back requests (returns errors or an empty
    # batch). Retry with backoff so a transient throttle doesn't yield 0 reviews.
    last_exc = None
    for i in range(attempts):
        try:
            result, _ = reviews(app_id, lang="vi", country="vn",
                                sort=Sort.NEWEST, count=count)
            if result:
                return result
        except Exception as e:
            last_exc = e
        time.sleep(2 * (i + 1))
    if last_exc:
        raise last_exc
    return []

def as_search_live(name):
    try:
        resp = requests.get("https://itunes.apple.com/search",
                            params={"term": name, "country": "vn",
                                    "entity": "software", "limit": 5}, timeout=20)
        items = resp.json().get("results", [])
    except Exception:
        return []
    return [{"title": it["trackName"], "developer": it.get("artistName", ""),
             "icon": it.get("artworkUrl100", ""), "app_id": str(it["trackId"]),
             "store": "app_store"} for it in items]

def _as_fetch_pages(app_id, count):
    out = []
    for page in range(1, 11):  # up to 10 pages × 50 reviews
        url = (f"https://itunes.apple.com/vn/rss/customerreviews/"
               f"page={page}/id={app_id}/sortby=mostrecent/json")
        resp = requests.get(url, timeout=20)
        entries = resp.json().get("feed", {}).get("entry", [])
        if isinstance(entries, dict):  # iTunes returns a dict when there's one entry
            entries = [entries]
        review_entries = [e for e in entries if "im:rating" in e]
        for e in review_entries:
            out.append({
                "review_id": e["id"]["label"],
                "user_name": e.get("author", {}).get("name", {}).get("label", ""),
                "review": e.get("content", {}).get("label", ""),
                "rating": int(e["im:rating"]["label"]),
                "date": e.get("updated", {}).get("label", ""),
            })
        if not review_entries or len(out) >= count:
            break
    return out[:count]

def as_reviews_live(app_id, count, attempts=3):
    # Apple's RSS throttles under rapid requests (returns empty/errors). Retry with
    # backoff so a transient throttle doesn't look like "no reviews".
    last_exc = None
    for i in range(attempts):
        try:
            out = _as_fetch_pages(app_id, count)
            if out:
                return out
        except Exception as e:
            last_exc = e
        time.sleep(2 * (i + 1))
    if last_exc:
        raise last_exc
    return []
