import os
import glob
import queue
import time
import uuid
import unicodedata
import threading
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
from datetime import datetime, timezone, timedelta
from flask import Flask, jsonify, request
from storage import merge_app_metadata

DASHBOARD_DIR = os.path.join(os.path.dirname(__file__), "dashboard")
ANALYZING_STALE_AFTER = timedelta(minutes=10)
REVIEW_DAY_TZ = timezone(timedelta(hours=7))
_RUN_QUEUE = queue.Queue()
_QUEUE_LOCK = threading.Lock()
_QUEUED_KEYS = set()
_CANCEL_KEYS = set()
_QUEUE_WORKER_STARTED = False
_RUNNING_KEY = None
_APPS_CACHE_LOCK = threading.Lock()
_APPS_FULL_CACHE = {"at": 0.0, "body": None}
_APPS_LITE_CACHE = {"at": 0.0, "body": None}
APPS_FULL_CACHE_SECONDS = 15
APPS_ACTIVE_CACHE_SECONDS = 2
SCHEDULED_REFRESH_INTERVAL = timedelta(hours=1)
_METADATA_BACKFILL_LOCK = threading.Lock()
_METADATA_BACKFILL_CACHE = {}
_REGISTRY_PATCH_LOCK = threading.Lock()


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

def _parse_datetime(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)

def _review_day_key(value):
    raw = str(value or "")
    if not raw:
        return ""
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return raw[:10]
    if parsed.tzinfo is None:
        return parsed.date().isoformat()
    return parsed.astimezone(REVIEW_DAY_TZ).date().isoformat()

def _source_cutoff_day_key():
    return (datetime.now(REVIEW_DAY_TZ).date() - timedelta(days=1)).isoformat()

def _review_is_in_source_window(review, cutoff_day=None):
    day = _review_day_key((review or {}).get("at"))
    if not day:
        return True
    return day <= (cutoff_day or _source_cutoff_day_key())

def _source_window_reviews(reviews, cutoff_day=None):
    cutoff = cutoff_day or _source_cutoff_day_key()
    return [r for r in (reviews or []) if _review_is_in_source_window(r, cutoff)]

def _int_or_none(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None

def _gallery_review_total(store, meta, cutoff_day):
    # Memory-backed review lists are chunked remote documents. Loading every
    # app's full review blob just to draw the gallery makes initial page load
    # very slow, so use the latest run summary there. Local files are cheap and
    # can keep the exact source-window count for tests/dev.
    if store.__class__.__name__ == "LocalStore":
        return len(_source_window_reviews(store.load_reviews(), cutoff_day))
    meta_total = _meta_review_total(meta)
    stored_total = _store_review_count(store, cutoff_day, allow_local=True)
    return _best_review_total(meta_total, stored_total=stored_total)

def _meta_review_total(meta):
    """Return a stored review total from crawl metadata without loading reviews."""
    last_run = (meta or {}).get("last_run") or {}
    total = _int_or_none(last_run.get("total_reviews") if isinstance(last_run, dict) else None)
    if total is not None:
        return total
    progress = (meta or {}).get("progress") or {}
    done = _int_or_none(progress.get("done") if isinstance(progress, dict) else None)
    return done

def _store_review_count(store, cutoff_day=None, allow_local=False):
    if store.__class__.__name__ == "LocalStore":
        if not allow_local:
            return None
        return len(_source_window_reviews(store.load_reviews(), cutoff_day))
    count_fn = getattr(store, "review_count", None)
    if callable(count_fn):
        return _int_or_none(count_fn())
    return None

def _best_review_total(meta_total=None, registry_total=None, stored_total=None):
    values = (meta_total, registry_total, stored_total)
    for value in values:
        if value is not None and value > 0:
            return value
    for value in values:
        if value is not None:
            return value
    return 0

def _gallery_app_entry(app_obj, store):
    """Merge registry metadata with per-app config before drawing the gallery.

    Some production registry rows were created before icon backfills existed,
    while their scoped config already has the App Store / Google Play icon. The
    gallery should use the richer scoped config without loading review blobs.
    """
    entry = dict(app_obj or {})
    try:
        cfg = store.load_config() or {}
    except Exception:
        cfg = {}
    if isinstance(cfg, dict) and cfg:
        entry = merge_app_metadata(entry, cfg)
    if app_obj and app_obj.get("app_id"):
        entry["app_id"] = app_obj["app_id"]
    return entry

def _live_metadata_backfill(entry):
    """Lookup current store metadata for old registry rows missing icon/developer."""
    if entry.get("icon") and entry.get("developer"):
        return {}
    key = (entry.get("as_id") or "", entry.get("gp_id") or "")
    if not any(key):
        return {}
    with _METADATA_BACKFILL_LOCK:
        if key in _METADATA_BACKFILL_CACHE:
            return dict(_METADATA_BACKFILL_CACHE[key])

    patch = {}
    try:
        from scraper_live import as_lookup_live, gp_lookup_live
        candidates = []
        if entry.get("as_id"):
            candidates.append(as_lookup_live(entry.get("as_id")))
        if entry.get("gp_id"):
            candidates.append(gp_lookup_live(entry.get("gp_id")))
        for candidate in candidates:
            if not isinstance(candidate, dict):
                continue
            patch = merge_app_metadata(patch, candidate)
            if patch.get("icon") and patch.get("developer"):
                break
    except Exception:
        patch = {}

    cleaned = {}
    for field in ("icon", "developer", "as_id", "gp_id"):
        if not entry.get(field) and patch.get(field):
            cleaned[field] = patch[field]
    stores = sorted(set((entry.get("stores") or []) + (patch.get("stores") or [])))
    if stores and stores != (entry.get("stores") or []):
        cleaned["stores"] = stores
    patch = cleaned
    with _METADATA_BACKFILL_LOCK:
        _METADATA_BACKFILL_CACHE[key] = dict(patch)
    return patch

def _maybe_backfill_gallery_metadata(entry, registry, store):
    if entry.get("icon") and entry.get("developer"):
        return entry
    patch = _live_metadata_backfill(entry)
    if not patch:
        return entry
    merged = merge_app_metadata(entry, patch)
    app_id = entry.get("app_id")
    if app_id:
        try:
            with _REGISTRY_PATCH_LOCK:
                registry.update_app(app_id, patch)
            store.save_config(merged)
        except Exception:
            pass
    return merged

def _clear_apps_cache():
    with _APPS_CACHE_LOCK:
        _APPS_FULL_CACHE["at"] = 0.0
        _APPS_FULL_CACHE["body"] = None
        _APPS_LITE_CACHE["at"] = 0.0
        _APPS_LITE_CACHE["body"] = None

def _crawl_active():
    with _QUEUE_LOCK:
        return _RUNNING_KEY is not None or bool(_QUEUED_KEYS)

def _apps_cache_ttl():
    # While a crawl is running/queued, per-app progress changes every few seconds,
    # so the gallery must refresh quickly to stay in sync with the detail view's
    # live progress. When idle, keep the longer cache to avoid rebuilding the
    # (expensive) full app list on every poll.
    return APPS_ACTIVE_CACHE_SECONDS if _crawl_active() else APPS_FULL_CACHE_SECONDS

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
        if current.get("last_scheduled_refresh_at"):
            meta["last_scheduled_refresh_at"] = current["last_scheduled_refresh_at"]
        store.save_meta(meta)
        _clear_apps_cache()
    except Exception:
        pass

def _is_cancel_requested(key):
    with _QUEUE_LOCK:
        return key in _CANCEL_KEYS

def _mark_canceled_idle(store):
    """Release an app back to idle after a cancel, preserving any reviews already
    classified so they still count toward the dashboard (never reset/removed)."""
    try:
        current = store.load_meta() or {}
        meta = {
            "status": "idle",
            "progress": current.get("progress", {"done": 0, "total": 0}),
            "last_updated": _now(),
            "cancelled": True,
        }
        last_run = current.get("last_run")
        if last_run:
            lr = dict(last_run)
            lr["cancelled"] = True
            meta["last_run"] = lr
        if current.get("last_scheduled_refresh_at"):
            meta["last_scheduled_refresh_at"] = current["last_scheduled_refresh_at"]
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
            # Cancelled while still waiting in the queue: never start it, but keep
            # whatever reviews the app already has.
            cancelled_before_start = key in _CANCEL_KEYS
            if cancelled_before_start:
                _CANCEL_KEYS.discard(key)
                _QUEUED_KEYS.discard(key)
            else:
                _RUNNING_KEY = key
        if cancelled_before_start:
            _mark_canceled_idle(store)
            _clear_apps_cache()
            _RUN_QUEUE.task_done()
            continue
        try:
            while True:
                result = run_pipeline(store=store, review_limit=review_limit,
                                      should_cancel=lambda: _is_cancel_requested(key))
                if not (isinstance(result, dict) and result.get("skipped")):
                    break
                if _is_cancel_requested(key):
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
                _CANCEL_KEYS.discard(key)
                if _RUNNING_KEY == key:
                    _RUNNING_KEY = None
            _clear_apps_cache()
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
    position = snapshot["positions"].get(key)
    running_key = snapshot["running_key"]
    other_running = running_key is not None and running_key != key
    # How many crawls will run BEFORE this one: any app currently running plus the
    # apps queued ahead of it. 0 means it is next (or already running) — so the UI
    # must not say "runs after the app ahead" when nothing is actually ahead.
    if position is None:
        ahead = 0
    else:
        ahead = (position - 1) + (1 if other_running else 0)
    return {
        "queue_position": position,
        "queue_waiting_count": snapshot["waiting_count"],
        "queue_running": running_key == key,
        "queue_ahead": ahead,
    }

def _scheduled_refresh_due(store, now=None, interval=None):
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    now = now.astimezone(timezone.utc)
    interval = interval or SCHEDULED_REFRESH_INTERVAL
    try:
        meta = store.load_meta() or {}
    except Exception:
        return True

    last_updated = _parse_datetime(meta.get("last_updated"))
    if meta.get("status") in ("analyzing", "queued"):
        if last_updated is None or now - last_updated <= ANALYZING_STALE_AFTER:
            return False

    last_scheduled = _parse_datetime(meta.get("last_scheduled_refresh_at"))
    reference = last_scheduled or last_updated
    if reference is None:
        return True
    return now - reference >= interval

def _mark_scheduled_refresh(store, when=None):
    when = when or datetime.now(timezone.utc)
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    try:
        meta = dict(store.load_meta() or {})
        meta["last_scheduled_refresh_at"] = when.astimezone(timezone.utc).isoformat()
        store.save_meta(meta)
    except Exception:
        pass

def _enqueue_scheduled_crawls(registry, store_factory, run_fn, now=None, interval=None):
    now = now or datetime.now(timezone.utc)
    apps = [
        app
        for app in registry.list_apps()
        if app.get("app_id") and _hourly_refresh_enabled(app)
    ]
    enqueued = 0
    for app_obj in apps:
        store = store_factory(app_obj["app_id"])
        if not _scheduled_refresh_due(store, now=now, interval=interval):
            continue
        _mark_scheduled_refresh(store, when=now)
        run_fn(store)
        enqueued += 1
    return enqueued

def create_app(registry=None, store_factory=None, resolve_fn=None, run_fn=None,
               feedback_store=None):
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
    if feedback_store is None:
        from storage import get_feedback_store
        feedback_store = get_feedback_store()

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
        # Gallery order: Zalopay first → apps with refresh ON → alphabetical.
        title = (app_obj.get("title") or app_obj.get("app_id") or "").lower()
        app_id = str(app_obj.get("app_id") or "").lower()
        is_zalopay = app_id == "1112407590" or "zalopay" in app_id or "zalopay" in title
        refresh_on = _hourly_refresh_enabled(app_obj)
        ascii_title = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode("ascii")
        return (0 if is_zalopay else 1, 0 if refresh_on else 1, ascii_title)

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
        _clear_apps_cache()
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
            _clear_apps_cache()

        return jsonify({"ok": True, "app": updated}), 200

    @app.get("/api/apps")
    def apps():
        # Include each app's crawl status and review total so the gallery can
        # show useful counts before a user opens an individual dashboard.
        if not app.config.get("TESTING") and request.args.get("lite") not in ("1", "true", "yes"):
            with _APPS_CACHE_LOCK:
                cached = _APPS_FULL_CACHE.get("body")
                age = time.monotonic() - float(_APPS_FULL_CACHE.get("at") or 0)
                if cached is not None and age < _apps_cache_ttl():
                    return _no_cache(jsonify(cached))

        reg = registry.load()
        app_objs = reg.get("apps", [])
        active_app_id = reg.get("active_app_id")
        queue_snapshot = _queue_snapshot()
        cutoff_day = _source_cutoff_day_key()
        lite = request.args.get("lite") in ("1", "true", "yes")

        if lite:
            if not app.config.get("TESTING"):
                with _APPS_CACHE_LOCK:
                    cached = _APPS_LITE_CACHE.get("body")
                    age = time.monotonic() - float(_APPS_LITE_CACHE.get("at") or 0)
                    if cached is not None and age < _apps_cache_ttl():
                        return _no_cache(jsonify(cached))

            def build_lite_entry(a):
                store = store_factory(a["app_id"])
                entry = _gallery_app_entry(a, store)
                # NOTE: live metadata backfill (_maybe_backfill_gallery_metadata)
                # is deliberately skipped here. It does network scraping (App Store
                # / Google Play lookups) for apps missing an icon/developer, which
                # is far too slow for the first-paint gallery. The full /api/apps
                # poll that follows backfills those fields shortly after, so the
                # initial load stays fast and the icons fill in moments later.
                try:
                    meta = normalize_meta(store)
                except Exception as exc:
                    meta = {"error": str(exc)}
                meta_total = _meta_review_total(meta)
                registry_total = _int_or_none(entry.get("total_reviews"))
                stored_total = _store_review_count(store, cutoff_day)
                entry["status"] = meta.get("status") or entry.get("status") or "idle"
                entry["progress"] = meta.get("progress") or entry.get("progress") or {"done": 0, "total": 0}
                entry["last_updated"] = meta.get("last_updated") or entry.get("last_updated")
                entry["last_run"] = meta.get("last_run") or entry.get("last_run")
                entry["error"] = meta.get("error") or entry.get("error")
                entry["source_cutoff_day"] = cutoff_day
                entry["total_reviews"] = _best_review_total(meta_total, registry_total, stored_total)
                entry["hourly_refresh_enabled"] = _hourly_refresh_enabled(entry)
                entry["queue_position"] = entry.get("queue_position")
                entry["queue_waiting_count"] = entry.get("queue_waiting_count")
                entry["queue_running"] = bool(entry.get("queue_running"))
                return entry

            if len(app_objs) > 1:
                with ThreadPoolExecutor(max_workers=min(16, len(app_objs))) as pool:
                    out = list(pool.map(build_lite_entry, app_objs))
            else:
                out = [build_lite_entry(a) for a in app_objs]
            out.sort(key=gallery_sort_key)
            body = {"active_app_id": active_app_id, "apps": out}
            if not app.config.get("TESTING"):
                with _APPS_CACHE_LOCK:
                    _APPS_LITE_CACHE["at"] = time.monotonic()
                    _APPS_LITE_CACHE["body"] = body
            return _no_cache(jsonify(body))

        def build_entry(a):
            store = store_factory(a["app_id"])
            try:
                meta = normalize_meta(store)
            except Exception as exc:
                meta = {"status": "idle", "progress": {"done": 0, "total": 0}, "error": str(exc)}
            entry = _gallery_app_entry(a, store)
            if not app.config.get("TESTING"):
                entry = _maybe_backfill_gallery_metadata(entry, registry, store)
            entry["status"] = meta.get("status", "idle")
            entry["progress"] = meta.get("progress", {"done": 0, "total": 0})
            entry["last_updated"] = meta.get("last_updated")
            entry["last_run"] = meta.get("last_run")
            entry["error"] = meta.get("error")
            entry["source_cutoff_day"] = cutoff_day
            entry["total_reviews"] = _gallery_review_total(store, meta, cutoff_day)
            entry["hourly_refresh_enabled"] = _hourly_refresh_enabled(entry)
            entry.update(_queue_details(store, queue_snapshot))
            return entry

        if len(app_objs) > 1:
            with ThreadPoolExecutor(max_workers=min(16, len(app_objs))) as pool:
                out = list(pool.map(build_entry, app_objs))
        else:
            out = [build_entry(a) for a in app_objs]
        out.sort(key=gallery_sort_key)
        body = {"active_app_id": active_app_id, "apps": out}
        if not app.config.get("TESTING"):
            with _APPS_CACHE_LOCK:
                _APPS_FULL_CACHE["at"] = time.monotonic()
                _APPS_FULL_CACHE["body"] = body
        return _no_cache(jsonify(body))

    @app.post("/api/active")
    def set_active():
        app_id = (request.get_json(silent=True) or {}).get("app_id")
        registry.set_active(app_id)
        _clear_apps_cache()
        return jsonify({"ok": True, "app_id": app_id})

    @app.post("/run")
    def run_now():
        store = active_store()
        if store is None:
            return jsonify({"ok": False, "error": "no active app"}), 200
        run_fn(store)
        return jsonify({"ok": True, "started": True}), 200

    @app.post("/api/cancel")
    def cancel_run():
        # Cancel an in-flight collect/classify run for one app. Reviews already
        # classified are kept (the pipeline stops at the next batch boundary and
        # still regroups), so they remain in the dashboard totals.
        data = request.get_json(silent=True) or {}
        app_id = data.get("app_id") or request.args.get("app_id") or registry.get_active()
        store = store_factory(app_id) if app_id else None
        if store is None:
            return jsonify({"ok": False, "error": "no app"}), 200
        key = _store_queue_key(store)
        with _QUEUE_LOCK:
            running = _RUNNING_KEY == key
            queued = key in _QUEUED_KEYS
            if running or queued:
                _CANCEL_KEYS.add(key)
        if not (running or queued):
            try:
                meta = normalize_meta(store)
            except Exception:
                meta = store.load_meta() or {}
            return jsonify({"ok": True, "cancelling": False,
                            "status": meta.get("status", "idle")}), 200
        return jsonify({"ok": True, "cancelling": True,
                        "running": running, "queued": queued}), 200

    def _no_cache(resp):
        # Same-URL JSON endpoints must never be served from the browser cache,
        # or switching apps would show a stale (previously loaded) app's data.
        resp.headers["Cache-Control"] = "no-store, max-age=0"
        return resp

    @app.get("/api/stats")
    def stats():
        store = request_store()
        cutoff_day = _source_cutoff_day_key()
        if store is None:
            return _no_cache(jsonify({"app": {}, "total": 0, "by_label": {}, "bug_by_day": {},
                            "source_cutoff_day": cutoff_day,
                            "meta": {"status": "idle", "progress": {"done": 0, "total": 0},
                                     "last_updated": None, "source_cutoff_day": cutoff_day}}))
        reviews = _source_window_reviews(store.load_reviews(), cutoff_day)
        meta = dict(normalize_meta(store))
        meta.update(_queue_details(store))
        meta["source_cutoff_day"] = cutoff_day
        by_label = dict(Counter(r.get("label") for r in reviews))
        by_day = dict(Counter(
            _review_day_key(r.get("at")) for r in reviews if r.get("label") == "BUG_REPORT"
        ))
        return _no_cache(jsonify({"app": store.load_config(), "total": len(reviews),
                        "source_cutoff_day": cutoff_day,
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
        return _no_cache(jsonify(_source_window_reviews(store.load_reviews()) if store else []))

    @app.get("/api/feedback")
    def get_feedback():
        try:
            items = feedback_store.load()
        except Exception:
            items = []
        return _no_cache(jsonify(items))

    @app.post("/api/feedback")
    def post_feedback():
        # Global product feedback — persisted in the shared store so it survives
        # reloads and everyone on the workspace sees it.
        data = request.get_json(silent=True) or {}
        text = str(data.get("text") or "").strip()
        if not text:
            return jsonify({"ok": False, "error": "empty feedback"}), 200
        ftype = data.get("type")
        if ftype not in ("idea", "bug", "praise"):
            ftype = "idea"
        try:
            rating = int(data.get("rating") or 0)
        except (TypeError, ValueError):
            rating = 0
        rating = max(0, min(5, rating))
        entry = {
            "id": "fb-" + uuid.uuid4().hex[:12],
            "type": ftype,
            "name": (str(data.get("name") or "").strip())[:80],
            "text_vi": text[:2000],
            "text_en": text[:2000],
            "rating": rating,
            "at": _now(),
        }
        try:
            items = feedback_store.add(entry)
        except Exception as exc:
            return jsonify({"ok": False, "error": str(exc)}), 200
        return jsonify({"ok": True, "entry": entry, "items": items}), 200

    return app

def _start_scheduler():
    import schedule
    import time
    from storage import get_store, get_registry

    def run_tracked_apps():
        _enqueue_scheduled_crawls(get_registry(), get_store, _scheduled_run_fn)

    # Run a cheap due check on start/cold-start and then periodically. The due
    # gate prevents a cold start from refreshing every hourly-enabled app.
    run_tracked_apps()
    schedule.every(5).minutes.do(run_tracked_apps)
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
