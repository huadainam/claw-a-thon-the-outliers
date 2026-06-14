import os
import glob
import queue
import unicodedata
import threading
from collections import Counter
from datetime import datetime, timezone, timedelta
from flask import Flask, jsonify, request

DASHBOARD_DIR = os.path.join(os.path.dirname(__file__), "dashboard")
ANALYZING_STALE_AFTER = timedelta(minutes=10)
_RUN_QUEUE = queue.Queue()
_QUEUE_LOCK = threading.Lock()
_QUEUED_KEYS = set()
_QUEUE_WORKER_STARTED = False
_RUNNING_KEY = None


def _asset_build_stamp():
    """A cache-busting token that changes whenever any dashboard asset changes.
    Newest file mtime → stable across restarts if code is unchanged, but always
    fresh after a new image build (COPY rewrites mtimes), so browsers never run
    a stale .jsx/.css after a deploy."""
    try:
        files = glob.glob(os.path.join(DASHBOARD_DIR, "*.js")) \
            + glob.glob(os.path.join(DASHBOARD_DIR, "*.jsx")) \
            + [os.path.join(DASHBOARD_DIR, "styles.css")]
        return str(int(max(os.path.getmtime(f) for f in files if os.path.exists(f))))
    except Exception:
        return "1"

def _now():
    return datetime.now(timezone.utc).isoformat()

def _bool_flag(value, default=True):
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip().lower() not in ("0", "false", "no", "off")
    return bool(value)

def _hourly_refresh_enabled(app_obj):
    return _bool_flag((app_obj or {}).get("hourly_refresh_enabled"), False)

def _store_queue_key(store):
    try:
        cfg = store.load_config() or {}
    except Exception:
        cfg = {}
    return str(
        cfg.get("app_id") or cfg.get("gp_id") or cfg.get("as_id")
        or cfg.get("title") or id(store)
    )

def _mark_queued(store):
    try:
        current = store.load_meta() or {}
        meta = {
            "status": "queued",
            "progress": current.get("progress", {"done": 0, "total": 0}),
            "last_updated": _now(),
        }
        if current.get("last_run"):
            meta["last_run"] = current["last_run"]
        store.save_meta(meta)
    except Exception:
        pass

def _queue_worker():
    global _RUNNING_KEY
    from pipeline import run_pipeline
    import time
    while True:
        item = _RUN_QUEUE.get()
        if len(item) == 2:
            key, store = item
            review_limit = None
        else:
            key, store, review_limit = item
        with _QUEUE_LOCK:
            _RUNNING_KEY = key
        try:
            while True:
                result = run_pipeline(store=store, review_limit=review_limit)
                if not (isinstance(result, dict) and result.get("skipped")):
                    break
                time.sleep(2)
        except Exception as exc:
            try:
                current = store.load_meta() or {}
                store.save_meta({
                    "status": "idle",
                    "progress": current.get("progress", {"done": 0, "total": 0}),
                    "last_updated": _now(),
                    "error": str(exc),
                })
            except Exception:
                pass
        finally:
            with _QUEUE_LOCK:
                _QUEUED_KEYS.discard(key)
                if _RUNNING_KEY == key:
                    _RUNNING_KEY = None
            _RUN_QUEUE.task_done()

def _ensure_queue_worker():
    global _QUEUE_WORKER_STARTED
    with _QUEUE_LOCK:
        if _QUEUE_WORKER_STARTED:
            return
        threading.Thread(target=_queue_worker, daemon=True).start()
        _QUEUE_WORKER_STARTED = True

def _default_run_fn(store, review_limit=None):
    """Production runner: enqueue pipeline work so multiple app selections do
    not get dropped by the pipeline's single-run lock."""
    _ensure_queue_worker()
    key = _store_queue_key(store)
    with _QUEUE_LOCK:
        if key in _QUEUED_KEYS:
            return
        _QUEUED_KEYS.add(key)
    _mark_queued(store)
    _RUN_QUEUE.put((key, store, review_limit))

def _scheduled_run_fn(store):
    from config import get_config
    _default_run_fn(store, review_limit=get_config().refresh_review_limit)

def _queue_positions(waiting_keys):
    return {key: idx + 1 for idx, key in enumerate(waiting_keys)}

def _queue_snapshot():
    with _RUN_QUEUE.mutex:
        waiting_keys = [item[0] for item in list(_RUN_QUEUE.queue)]
    with _QUEUE_LOCK:
        running_key = _RUNNING_KEY
    return {
        "positions": _queue_positions(waiting_keys),
        "waiting_count": len(waiting_keys),
        "running_key": running_key,
    }

def _queue_details(store, snapshot=None):
    snapshot = snapshot or _queue_snapshot()
    key = _store_queue_key(store)
    return {
        "queue_position": snapshot["positions"].get(key),
        "queue_waiting_count": snapshot["waiting_count"],
        "queue_running": snapshot["running_key"] == key,
    }

def _enqueue_scheduled_crawls(registry, store_factory, run_fn):
    apps = [
        app
        for app in registry.list_apps()
        if app.get("app_id") and _hourly_refresh_enabled(app)
    ]
    for app_obj in apps:
        run_fn(store_factory(app_obj["app_id"]))
    return len(apps)

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

    def normalize_meta(store):
        meta = store.load_meta()
        status = meta.get("status")
        if status not in ("analyzing", "queued"):
            return meta
        raw = meta.get("last_updated")
        try:
            last = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
            if last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
        except (TypeError, ValueError):
            last = None
        if status == "queued":
            with _QUEUE_LOCK:
                is_queued_in_this_process = _store_queue_key(store) in _QUEUED_KEYS
            if is_queued_in_this_process:
                return meta
            recovered = dict(meta)
            recovered["status"] = "idle"
            recovered["last_updated"] = datetime.now(timezone.utc).isoformat()
            recovered["error"] = "Queued crawl was interrupted before it started."
            store.save_meta(recovered)
            return recovered

        if last and datetime.now(timezone.utc) - last <= ANALYZING_STALE_AFTER:
            return meta

        recovered = dict(meta)
        recovered["status"] = "idle"
        recovered["last_updated"] = datetime.now(timezone.utc).isoformat()
        recovered["error"] = "Crawl worker stopped before finishing."
        store.save_meta(recovered)
        return recovered

    @app.get("/health")
    def health():
        return jsonify({"status": "ok"}), 200

    @app.get("/")
    def index():
        # Inject the cache-busting build stamp so a redeploy always serves fresh
        # JS/CSS (the .jsx files are otherwise reused from the browser cache).
        with open(os.path.join(DASHBOARD_DIR, "index.html"), encoding="utf-8") as f:
            html = f.read()
        return html.replace("__BUILD__", _asset_build_stamp())

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
        if "hourly_refresh_enabled" in data:
            app_obj["hourly_refresh_enabled"] = _bool_flag(data.get("hourly_refresh_enabled"), True)
        app_id = registry.upsert_app(app_obj)  # adds + makes active
        store = store_factory(app_id)
        store.save_config(registry.get_app(app_id))
        cached = bool(store.load_reviews())  # show cache instantly while we refresh
        run_fn(store)
        return jsonify({"ok": True, "app_id": app_id, "cached": cached}), 200

    @app.patch("/api/apps/<app_id>")
    def patch_app(app_id):
        current = registry.get_app(app_id)
        if current is None:
            return jsonify({"ok": False, "error": "app not found"}), 404

        data = request.get_json(silent=True) or {}
        patch = {}
        if "hourly_refresh_enabled" in data:
            patch["hourly_refresh_enabled"] = _bool_flag(data.get("hourly_refresh_enabled"), True)

        if not patch:
            updated = current
        else:
            updated = registry.update_app(app_id, patch)
            if updated is None:
                return jsonify({"ok": False, "error": "app not found"}), 404
            store_factory(app_id).save_config(updated)

        return jsonify({"ok": True, "app": updated}), 200

    @app.get("/api/apps")
    def apps():
        # Include each app's crawl status and review total so the gallery can
        # show useful counts before a user opens an individual dashboard.
        out = []
        queue_snapshot = _queue_snapshot()
        for a in registry.list_apps():
            store = store_factory(a["app_id"])
            meta = normalize_meta(store)
            entry = dict(a)
            entry["status"] = meta.get("status", "idle")
            entry["progress"] = meta.get("progress", {"done": 0, "total": 0})
            entry["last_updated"] = meta.get("last_updated")
            entry["last_run"] = meta.get("last_run")
            entry["error"] = meta.get("error")
            entry["total_reviews"] = len(store.load_reviews())
            entry["hourly_refresh_enabled"] = _hourly_refresh_enabled(a)
            entry.update(_queue_details(store, queue_snapshot))
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
        meta = dict(normalize_meta(store))
        meta.update(_queue_details(store))
        by_label = dict(Counter(r.get("label") for r in reviews))
        by_day = dict(Counter(
            (r.get("at") or "")[:10] for r in reviews if r.get("label") == "BUG_REPORT"
        ))
        return _no_cache(jsonify({"app": store.load_config(), "total": len(reviews),
                        "by_label": by_label, "bug_by_day": by_day,
                        "meta": meta}))

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
    from storage import get_store, get_registry

    def run_tracked_apps():
        _enqueue_scheduled_crawls(get_registry(), get_store, _scheduled_run_fn)

    run_tracked_apps()
    schedule.every(1).hours.do(run_tracked_apps)
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
