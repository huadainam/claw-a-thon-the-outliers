import argparse
import json
import os
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from pipeline import run_pipeline
from scraper import resolve_app
from storage import get_registry, get_store


REVIEW_LIMIT = 500

CORE_APPS = [
    {
        "name": "Zalo",
        "fallback": {"title": "Zalo", "as_id": "579523206", "developer": "Zalo Group", "stores": ["app_store"]},
    },
    {
        "name": "Zalopay",
        "fallback": {
            "title": "Zalopay-Thanh toán & Tài chính",
            "as_id": "1112407590",
            "developer": "ZION JOINT STOCK COMPANY",
            "stores": ["app_store"],
        },
    },
    {
        "name": "Zing MP3",
        "fallback": {
            "title": "Zing MP3 - Đỉnh Cao Âm Nhạc",
            "as_id": "992357547",
            "developer": "Zalo Group",
            "stores": ["app_store"],
        },
    },
    {
        "name": "ZingPlay - Cổng game - iCa",
        "fallback": {
            "title": "ZingPlay - Cổng game - iCa",
            "gp_id": "gsn.game.zingplaynew",
            "developer": "ZINGPLAY VIETNAM",
            "stores": ["google_play"],
        },
    },
    {"name": "Roblox VN", "fallback": {"title": "Roblox VN", "as_id": "6474715805", "developer": "VNGGames Co., Ltd", "stores": ["app_store"]}},
    {"name": "Play Together VNG", "fallback": {"title": "Play Together VNG", "as_id": "1612175933", "developer": "VNG CORPORATION", "stores": ["app_store"]}},
    {"name": "PUBG Mobile VN", "fallback": {"title": "PUBG Mobile VN", "as_id": "1438396625", "developer": "VNG CORPORATION", "stores": ["app_store"]}},
    {"name": "ChatGPT", "fallback": {"title": "ChatGPT", "as_id": "6448311069", "developer": "OpenAI OpCo, LLC", "stores": ["app_store"]}},
    {"name": "VNeID", "fallback": {"title": "VNeID", "as_id": "1582750372", "developer": "Trung tâm dữ liệu quốc gia về dân cư", "stores": ["app_store"]}},
    {"name": "My Viettel", "fallback": {"title": "My Viettel: Tích điểm, Đổi quà", "as_id": "1014838705", "developer": "Viettel Telecom", "stores": ["app_store"]}},
    {"name": "VTV Go", "fallback": {"title": "VTV Go Truyền hình số Quốc gia", "as_id": "1072038396", "developer": "Dai Truyen Hinh Viet Nam", "stores": ["app_store"]}},
    {"name": "TikTok", "fallback": {"title": "TikTok-Global Video Community", "as_id": "1235601864", "developer": "TikTok Ltd.", "stores": ["app_store"]}},
    {
        "name": "Shopee",
        "fallback": {
            "title": "Shopee 5.5 Giá Siêu Ưu Đãi",
            "as_id": "959841449",
            "developer": "SHOPEE COMPANY LIMITED",
            "stores": ["app_store"],
        },
    },
    {"name": "Messenger", "fallback": {"title": "Messenger", "as_id": "454638411", "developer": "Meta Platforms, Inc.", "stores": ["app_store"]}},
    {"name": "Facebook", "fallback": {"title": "Facebook", "as_id": "284882215", "developer": "Meta Platforms, Inc.", "stores": ["app_store"]}},
    {"name": "MB Bank", "fallback": {"title": "MB Bank", "as_id": "1205807363", "developer": "MB Bank", "stores": ["app_store"]}},
    {"name": "MoMo", "fallback": {"title": "MoMo-Trợ Thủ Tài Chính với AI", "as_id": "918751511", "developer": "M-SERVICE JSC", "stores": ["app_store"]}},
    {"name": "CapCut", "fallback": {"title": "CapCut: Photo & Video Editor", "as_id": "1500855883", "developer": "Bytedance Pte. Ltd", "stores": ["app_store"]}},
    {
        "name": "Green SM",
        "fallback": {
            "title": "Green SM: Electric Mobility",
            "as_id": "6446425595",
            "developer": "GSM GREEN AND SMART MOBILITY JOINT STOCK COMPANY",
            "stores": ["app_store"],
        },
    },
    {"name": "Grab", "fallback": {"title": "Grab: Food Delivery, Taxi Ride", "as_id": "647268330", "developer": "Grab.com", "stores": ["app_store"]}},
]


def norm(value):
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return " ".join(text.lower().replace("-", " ").replace(":", " ").split())


def app_key(app):
    return app.get("gp_id") or app.get("as_id") or app.get("title")


def existing_for(registry, fallback):
    wanted_ids = {fallback.get("gp_id"), fallback.get("as_id")}
    wanted_ids.discard(None)
    wanted_title = norm(fallback.get("title"))
    for app in registry.list_apps():
        ids = {app.get("app_id"), app.get("gp_id"), app.get("as_id")}
        if wanted_ids.intersection(ids):
            return app
        if wanted_title and norm(app.get("title")) == wanted_title:
            return app
    return None


def resolve_or_fallback(spec):
    # For known problematic/common names (Shopee, MoMo, etc.), the fallback is
    # intentionally authoritative so we do not accidentally crawl another app.
    if spec.get("fallback"):
        return dict(spec["fallback"])
    res = resolve_app(spec["name"])
    if res.get("status") == "matched" and res.get("app"):
        return res["app"]
    suggestions = res.get("suggestions") or []
    if suggestions:
        return suggestions[0]
    raise RuntimeError(f"Could not resolve {spec['name']}: {res.get('message')}")


def save_app_config(app_id):
    store = get_store(app_id)
    store.save_config(registry.get_app(app_id))
    return store


registry = get_registry()
parser = argparse.ArgumentParser()
parser.add_argument("--start-at", default="", help="Core app name or 1-based index to start crawling from.")
parser.add_argument("--only", action="store_true", help="Only crawl the --start-at app.")
args = parser.parse_args()

start_idx = 1
if args.start_at:
    if str(args.start_at).isdigit():
        start_idx = max(1, int(args.start_at))
    else:
        wanted = norm(args.start_at)
        for pos, spec in enumerate(CORE_APPS, start=1):
            if norm(spec["name"]) == wanted:
                start_idx = pos
                break
        else:
            raise SystemExit(f"Unknown --start-at value: {args.start_at}")

print("Disabling hourly refresh for non-core apps...", flush=True)
for app in registry.list_apps():
    app_id = app.get("app_id")
    if not app_id:
        continue
    updated = registry.update_app(app_id, {"hourly_refresh_enabled": False})
    if updated:
        get_store(app_id).save_config(updated)

core_ids = []
results = []

for idx, spec in enumerate(CORE_APPS, start=1):
    fallback = spec.get("fallback") or {}
    existing = existing_for(registry, fallback) if fallback else None
    app_obj = dict(existing or resolve_or_fallback(spec))
    app_obj["review_limit"] = REVIEW_LIMIT
    app_obj["hourly_refresh_enabled"] = True

    app_id = registry.upsert_app(app_obj)
    core_ids.append(app_id)
    store = save_app_config(app_id)

    before = len(store.load_reviews())
    if idx < start_idx:
        print(f"[{idx}/{len(CORE_APPS)}] {spec['name']} -> {app_obj.get('title')} ({app_id})", flush=True)
        print(f"  configured hourly=true, review_limit={REVIEW_LIMIT}; skipped crawl before --start-at", flush=True)
        continue
    if args.only and idx > start_idx:
        print(f"[{idx}/{len(CORE_APPS)}] {spec['name']} -> {app_obj.get('title')} ({app_id})", flush=True)
        print("  configured hourly=true; skipped crawl after --only target", flush=True)
        continue

    print(f"[{idx}/{len(CORE_APPS)}] {spec['name']} -> {app_obj.get('title')} ({app_id})", flush=True)
    print(f"  before_reviews={before}; running crawl limit={REVIEW_LIMIT}", flush=True)

    result = run_pipeline(store=store, review_limit=REVIEW_LIMIT)
    after = len(store.load_reviews())
    meta = store.load_meta() or {}
    summary = {
        "name": spec["name"],
        "app_id": app_id,
        "title": app_obj.get("title"),
        "before_reviews": before,
        "after_reviews": after,
        "result": result,
        "last_run": meta.get("last_run"),
    }
    results.append(summary)
    print("  result=" + json.dumps(summary, ensure_ascii=False), flush=True)

print("Re-applying core hourly flags...", flush=True)
for app_id in core_ids:
    updated = registry.update_app(app_id, {"hourly_refresh_enabled": True, "review_limit": REVIEW_LIMIT})
    if updated:
        get_store(app_id).save_config(updated)

print("CORE_INIT_SUMMARY=" + json.dumps(results, ensure_ascii=False), flush=True)
