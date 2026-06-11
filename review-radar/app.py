import os
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
        app_id = registry.upsert_app(app_obj)  # adds + makes active
        store = store_factory(app_id)
        store.save_config(registry.get_app(app_id))
        cached = bool(store.load_reviews())  # show cache instantly while we refresh
        run_fn(store)
        return jsonify({"ok": True, "app_id": app_id, "cached": cached}), 200

    @app.get("/api/apps")
    def apps():
        return jsonify({"active_app_id": registry.get_active(), "apps": registry.list_apps()})

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

    @app.get("/api/stats")
    def stats():
        store = active_store()
        if store is None:
            return jsonify({"app": {}, "total": 0, "by_label": {}, "bug_by_day": {},
                            "meta": {"status": "idle", "progress": {"done": 0, "total": 0},
                                     "last_updated": None}})
        reviews = store.load_reviews()
        by_label = dict(Counter(r.get("label") for r in reviews))
        by_day = dict(Counter(
            (r.get("at") or "")[:10] for r in reviews if r.get("label") == "BUG_REPORT"
        ))
        return jsonify({"app": store.load_config(), "total": len(reviews),
                        "by_label": by_label, "bug_by_day": by_day,
                        "meta": store.load_meta()})

    @app.get("/api/todos")
    def get_todos():
        store = active_store()
        return jsonify(store.load_todos() if store else [])

    @app.patch("/api/todos/<todo_id>")
    def patch_todo(todo_id):
        store = active_store()
        if store is None:
            return jsonify({"ok": False, "error": "no active app"}), 200
        data = request.get_json(silent=True) or {}
        todos = store.load_todos()
        for t in todos:
            if t["id"] == todo_id and "status" in data:
                t["status"] = data["status"]
        store.save_todos(todos)
        return jsonify({"ok": True})

    @app.get("/api/reviews")
    def get_reviews():
        store = active_store()
        return jsonify(store.load_reviews() if store else [])

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
    application = create_app()
    if "--serve" in sys.argv:
        threading.Thread(target=_start_scheduler, daemon=True).start()
    application.run(host="0.0.0.0", port=8080)
