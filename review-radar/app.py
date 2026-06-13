import os
import unicodedata
import threading
from collections import Counter
from flask import Flask, jsonify, request, send_from_directory

DASHBOARD_DIR = os.path.join(os.path.dirname(__file__), "dashboard")

def _default_run_fn(store):
    """Production runner: kick the pipeline off in a background thread so the
    HTTP request returns immediately and the dashboard can poll for progress."""
    from pipeline import run_pipeline
    threading.Thread(target=lambda: run_pipeline(store=store), daemon=True).start()

def create_app(registry=None, store_factory=None, resolve_fn=None, run_fn=None):
    if registry is None:
        from storage import get_registry
        registry = get_registry()
    if store_factory is None:
        from storage import get_store
        store_factory = get_store
    if resolve_fn is None:
        from scraper import resolve_app
        resolve_fn = resolve_app
    if run_fn is None:
        run_fn = _default_run_fn

    app = Flask(__name__, static_folder=DASHBOARD_DIR, static_url_path="")

    def active_store():
        aid = registry.get_active()
        return store_factory(aid) if aid else None

    def request_store():
        # Read endpoints accept an explicit ?app_id= so each app has its own URL
        # (no HTTP-cache collisions, no reliance on the single active-app state).
        # Falls back to the active app when no app_id is given.
        aid = request.args.get("app_id") or registry.get_active()
        return store_factory(aid) if aid else None

    def gallery_sort_key(app_obj):
        title = (app_obj.get("title") or app_obj.get("app_id") or "").lower()
        app_id = str(app_obj.get("app_id") or "").lower()
        is_zalopay = app_id == "1112407590" or "zalopay" in app_id or "zalopay" in title
        ascii_title = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode("ascii")
        return (0 if is_zalopay else 1, ascii_title)

    @app.get("/health")
    def health():
        return jsonify({"status": "ok"}), 200

    @app.get("/")
    def index():
        return send_from_directory(DASHBOARD_DIR, "index.html")

    @app.post("/api/resolve")
    def resolve():
        name = (request.get_json(silent=True) or {}).get("name", "").strip()
        if not name:
            return jsonify({"status": "not_found", "message": "Nhập tên app."}), 200
        return jsonify(resolve_fn(name)), 200

    @app.post("/api/track")
    def track():
        data = request.get_json(silent=True) or {}
        app_obj = {"title": data.get("title", ""), "gp_id": data.get("gp_id"),
                   "as_id": data.get("as_id"), "icon": data.get("icon", ""),
                   "developer": data.get("developer", ""), "stores": data.get("stores", [])}
        # Optional user-chosen number of reviews to scrape (persisted per app so
        # recurring crawls reuse it). Clamp to a sane range for backfills.
        try:
            rl = int(data.get("review_limit"))
            app_obj["review_limit"] = max(10, min(rl, 10000))
        except (TypeError, ValueError):
            pass
        app_id = registry.upsert_app(app_obj)  # adds + makes active
        store = store_factory(app_id)
        store.save_config(registry.get_app(app_id))
        cached = bool(store.load_reviews())  # show cache instantly while we refresh
        run_fn(store)
        return jsonify({"ok": True, "app_id": app_id, "cached": cached}), 200

    @app.get("/api/apps")
    def apps():
        # Include each app's crawl status and review total so the gallery can
        # show useful counts before a user opens an individual dashboard.
        out = []
        for a in registry.list_apps():
            store = store_factory(a["app_id"])
            meta = store.load_meta()
            entry = dict(a)
            entry["status"] = meta.get("status", "idle")
            entry["progress"] = meta.get("progress", {"done": 0, "total": 0})
            entry["last_updated"] = meta.get("last_updated")
            entry["total_reviews"] = len(store.load_reviews())
            out.append(entry)
        out.sort(key=gallery_sort_key)
        return _no_cache(jsonify({"active_app_id": registry.get_active(), "apps": out}))

    @app.post("/api/active")
    def set_active():
        app_id = (request.get_json(silent=True) or {}).get("app_id")
        registry.set_active(app_id)
        return jsonify({"ok": True, "app_id": app_id})

    @app.post("/run")
    def run_now():
        store = active_store()
        if store is None:
            return jsonify({"ok": False, "error": "no active app"}), 200
        run_fn(store)
        return jsonify({"ok": True, "started": True}), 200

    def _no_cache(resp):
        # Same-URL JSON endpoints must never be served from the browser cache,
        # or switching apps would show a stale (previously loaded) app's data.
        resp.headers["Cache-Control"] = "no-store, max-age=0"
        return resp

    @app.get("/api/stats")
    def stats():
        store = request_store()
        if store is None:
            return _no_cache(jsonify({"app": {}, "total": 0, "by_label": {}, "bug_by_day": {},
                            "meta": {"status": "idle", "progress": {"done": 0, "total": 0},
                                     "last_updated": None}}))
        reviews = store.load_reviews()
        by_label = dict(Counter(r.get("label") for r in reviews))
        by_day = dict(Counter(
            (r.get("at") or "")[:10] for r in reviews if r.get("label") == "BUG_REPORT"
        ))
        return _no_cache(jsonify({"app": store.load_config(), "total": len(reviews),
                        "by_label": by_label, "bug_by_day": by_day,
                        "meta": store.load_meta()}))

    @app.get("/api/todos")
    def get_todos():
        store = request_store()
        return _no_cache(jsonify(store.load_todos() if store else []))

    @app.patch("/api/todos/<todo_id>")
    def patch_todo(todo_id):
        app_id = request.args.get("app_id")
        store = store_factory(app_id) if app_id else active_store()
        if store is None:
            return jsonify({"ok": False, "error": "no active app"}), 200
        data = request.get_json(silent=True) or {}
        todos = store.load_todos()
        found = False
        for t in todos:
            if t["id"] == todo_id and "status" in data:
                t["status"] = data["status"]
                found = True
        store.save_todos(todos)
        return jsonify({"ok": found, "todo_id": todo_id, "app_id": app_id or registry.get_active()})

    @app.get("/api/reviews")
    def get_reviews():
        store = request_store()
        return _no_cache(jsonify(store.load_reviews() if store else []))

    return app

def _start_scheduler():
    import schedule
    import time
    from pipeline import run_pipeline
    from storage import get_store, get_registry

    def run_active():
        aid = get_registry().get_active()
        if aid:
            run_pipeline(store=get_store(aid))

    schedule.every(1).hours.do(run_active)
    while True:
        schedule.run_pending()
        time.sleep(60)

if __name__ == "__main__":
    import sys
    from storage import get_registry, get_store
    from bootstrap import bootstrap_from_seed
    n = bootstrap_from_seed(get_registry(), get_store)
    if n:
        print(f"Bootstrapped {n} apps from seed/")
    application = create_app()
    if "--serve" in sys.argv:
        threading.Thread(target=_start_scheduler, daemon=True).start()
    application.run(host="0.0.0.0", port=8080)
