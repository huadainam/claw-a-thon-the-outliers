import json
import os
import re
from abc import ABC, abstractmethod

DEFAULT_META = {"status": "idle", "progress": {"done": 0, "total": 0}, "last_updated": None}

def app_key(app: dict) -> str:
    """Stable partition key for an app: prefer Google Play id, else App Store id."""
    return app.get("gp_id") or app.get("as_id") or app.get("title", "unknown")

def _has_value(value) -> bool:
    if value is None:
        return False
    if value == "":
        return False
    if isinstance(value, (list, dict)) and not value:
        return False
    return True

def merge_app_metadata(existing: dict, incoming: dict) -> dict:
    """Merge app metadata without letting sparse refreshes erase known fields."""
    merged = dict(existing or {})
    for key, value in dict(incoming or {}).items():
        if _has_value(value) or key not in merged:
            merged[key] = value
    return merged

def _safe(app_id: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", str(app_id))

class Store(ABC):
    @abstractmethod
    def load_config(self) -> dict: ...
    @abstractmethod
    def save_config(self, cfg: dict): ...
    @abstractmethod
    def load_processed_ids(self) -> set: ...
    @abstractmethod
    def save_processed_ids(self, ids: set): ...
    @abstractmethod
    def load_reviews(self) -> list: ...
    @abstractmethod
    def append_reviews(self, reviews: list): ...
    def review_count(self) -> int:
        return len(self.load_reviews())
    @abstractmethod
    def load_todos(self) -> list: ...
    @abstractmethod
    def save_todos(self, todos: list): ...
    @abstractmethod
    def load_meta(self) -> dict: ...
    @abstractmethod
    def save_meta(self, meta: dict): ...
    @abstractmethod
    def reset(self): ...

class LocalStore(Store):
    def __init__(self, data_dir: str = "data", app_id: str = None):
        # Per-app data is partitioned under <data_dir>/apps/<app_id>/.
        self.base = os.path.join(data_dir, "apps", _safe(app_id)) if app_id else data_dir
        os.makedirs(self.base, exist_ok=True)

    def _path(self, name: str) -> str:
        return os.path.join(self.base, name)

    def _read(self, name: str, default):
        path = self._path(name)
        if not os.path.exists(path):
            return default
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return default

    def _write(self, name: str, value):
        with open(self._path(name), "w", encoding="utf-8") as f:
            json.dump(value, f, ensure_ascii=False, indent=2)

    def load_config(self) -> dict:
        return self._read("config.json", {})

    def save_config(self, cfg: dict):
        self._write("config.json", cfg)

    def load_processed_ids(self) -> set:
        return set(self._read("processed_ids.json", []))

    def save_processed_ids(self, ids: set):
        self._write("processed_ids.json", sorted(ids))

    def load_reviews(self) -> list:
        return self._read("reviews.json", [])

    def append_reviews(self, reviews: list):
        existing = self.load_reviews()
        existing.extend(reviews)
        self._write("reviews.json", existing)

    def load_todos(self) -> list:
        return self._read("todos.json", [])

    def save_todos(self, todos: list):
        self._write("todos.json", todos)

    def load_meta(self) -> dict:
        return self._read("meta.json", dict(DEFAULT_META))

    def save_meta(self, meta: dict):
        self._write("meta.json", meta)

    def reset(self):
        for name in ("processed_ids.json", "reviews.json", "todos.json", "meta.json"):
            path = self._path(name)
            if os.path.exists(path):
                os.remove(path)

import json as _json
import uuid

# Base session ids used as state keys inside the single Memory store. When the
# store is scoped to an app, the app_id is appended (e.g. "rr-reviews-<app_id>").
_SESS_CONFIG = "rr-config"
_SESS_IDS = "rr-processed-ids"
_SESS_REVIEWS = "rr-reviews"
_SESS_TODOS = "rr-todos"
_SESS_META = "rr-meta"

class MemoryStore(Store):
    REVIEWS_CHUNK_SIZE = 50

    def __init__(self, memory_id: str, actor_id: str = "review-radar", http=None, app_id: str = None):
        self.memory_id = memory_id
        self.actor_id = actor_id
        self.http = http  # object with post_event / list_events; real one set by get_store
        self._suffix = f"-{app_id}" if app_id else ""

    def _sess(self, base: str) -> str:
        return base + self._suffix

    def _save_doc(self, base: str, value):
        self.http.post_event(
            self.memory_id, self.actor_id, self._sess(base),
            _json.dumps(value, ensure_ascii=False),
        )

    def _load_doc(self, base: str, default):
        events = self.http.list_events(self.memory_id, self.actor_id, self._sess(base))
        if not events:
            return default
        try:
            return _json.loads(events[-1]["content"])
        except (ValueError, KeyError):
            return default

    def load_config(self) -> dict:
        return self._load_doc(_SESS_CONFIG, {})

    def save_config(self, cfg: dict):
        self._save_doc(_SESS_CONFIG, cfg)

    def load_processed_ids(self) -> set:
        return set(self._load_doc(_SESS_IDS, []))

    def save_processed_ids(self, ids: set):
        self._save_doc(_SESS_IDS, sorted(ids))

    def _reviews_index_sess(self):
        return f"{_SESS_REVIEWS}-index"

    def _reviews_chunk_sess(self, generation, idx):
        return f"{_SESS_REVIEWS}-chunk-{generation}-{idx}"

    def _save_reviews(self, reviews: list):
        reviews = list(reviews or [])
        generation = uuid.uuid4().hex
        chunks = [
            reviews[i:i + self.REVIEWS_CHUNK_SIZE]
            for i in range(0, len(reviews), self.REVIEWS_CHUNK_SIZE)
        ]
        for idx, chunk in enumerate(chunks):
            self._save_doc(self._reviews_chunk_sess(generation, idx), chunk)
        self._save_doc(self._reviews_index_sess(), {
            "version": 1,
            "generation": generation,
            "chunk_count": len(chunks),
            "count": len(reviews),
        })

    def load_reviews(self) -> list:
        index = self._load_doc(self._reviews_index_sess(), None)
        if not isinstance(index, dict) or index.get("version") != 1:
            return self._load_doc(_SESS_REVIEWS, [])

        generation = index.get("generation")
        chunk_count = int(index.get("chunk_count") or 0)
        total = int(index.get("count") or 0)
        if not generation or chunk_count <= 0:
            return []

        reviews = []
        for idx in range(chunk_count):
            chunk = self._load_doc(self._reviews_chunk_sess(generation, idx), [])
            if isinstance(chunk, list):
                reviews.extend(chunk)
        return reviews[:total]

    def review_count(self) -> int:
        index = self._load_doc(self._reviews_index_sess(), None)
        if isinstance(index, dict) and index.get("version") == 1:
            try:
                return int(index.get("count") or 0)
            except (TypeError, ValueError):
                return 0
        return len(self._load_doc(_SESS_REVIEWS, []))

    def append_reviews(self, reviews: list):
        existing = self.load_reviews()
        existing.extend(reviews)
        self._save_reviews(existing)

    def load_todos(self) -> list:
        return self._load_doc(_SESS_TODOS, [])

    def save_todos(self, todos: list):
        self._save_doc(_SESS_TODOS, todos)

    def load_meta(self) -> dict:
        return self._load_doc(_SESS_META, dict(DEFAULT_META))

    def save_meta(self, meta: dict):
        self._save_doc(_SESS_META, meta)

    def reset(self):
        self._save_doc(_SESS_IDS, [])
        self._save_doc(_SESS_REVIEWS, [])
        self._save_reviews([])
        self._save_doc(_SESS_TODOS, [])
        self._save_doc(_SESS_META, dict(DEFAULT_META))


# ---- App registry: the list of tracked apps + the active one --------------

class Registry(ABC):
    @abstractmethod
    def _load(self) -> dict: ...
    @abstractmethod
    def _save(self, reg: dict): ...

    def load(self) -> dict:
        reg = self._load() or {}
        reg.setdefault("active_app_id", None)
        reg.setdefault("apps", [])
        return reg

    def list_apps(self) -> list:
        return self.load()["apps"]

    def get_active(self):
        return self.load().get("active_app_id")

    def get_app(self, app_id: str):
        for a in self.list_apps():
            if a.get("app_id") == app_id:
                return a
        return None

    def set_active(self, app_id):
        reg = self.load()
        reg["active_app_id"] = app_id
        self._save(reg)

    def update_app(self, app_id: str, patch: dict):
        reg = self.load()
        updated = None
        apps = []
        for app in reg["apps"]:
            if app.get("app_id") == app_id:
                updated = merge_app_metadata(app, patch)
                updated["app_id"] = app_id
                apps.append(updated)
            else:
                apps.append(app)
        if updated is None:
            return None
        reg["apps"] = apps
        self._save(reg)
        return updated

    def upsert_app(self, app: dict) -> str:
        """Add or update an app (keyed by app_key), make it active, return its id."""
        key = app_key(app)
        reg = self.load()
        existing = next((a for a in reg["apps"] if a.get("app_id") == key), {})
        apps = [a for a in reg["apps"] if a.get("app_id") != key]
        app = merge_app_metadata(existing, app)
        app["app_id"] = key
        apps.append(app)
        reg["apps"] = apps
        reg["active_app_id"] = key
        self._save(reg)
        return key

class LocalRegistry(Registry):
    def __init__(self, data_dir: str = "data"):
        os.makedirs(data_dir, exist_ok=True)
        self.path = os.path.join(data_dir, "registry.json")

    def _load(self) -> dict:
        if not os.path.exists(self.path):
            return {}
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return {}

    def _save(self, reg: dict):
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(reg, f, ensure_ascii=False, indent=2)

class MemoryRegistry(Registry):
    _SESS = "rr-registry"

    def __init__(self, memory_id: str, http, actor_id: str = "review-radar"):
        self.memory_id = memory_id
        self.http = http
        self.actor_id = actor_id

    def _load(self) -> dict:
        events = self.http.list_events(self.memory_id, self.actor_id, self._SESS)
        if not events:
            return {}
        try:
            return _json.loads(events[-1]["content"])
        except (ValueError, KeyError):
            return {}

    def _save(self, reg: dict):
        self.http.post_event(self.memory_id, self.actor_id, self._SESS,
                             _json.dumps(reg, ensure_ascii=False))


# ---- Feedback log (global, not per-app) -----------------------------------

_SESS_FEEDBACK = "rr-feedback"
FEEDBACK_CAP = 200

class FeedbackStore(ABC):
    @abstractmethod
    def load(self) -> list: ...
    @abstractmethod
    def add(self, entry: dict) -> list: ...

class LocalFeedbackStore(FeedbackStore):
    def __init__(self, data_dir: str = "data"):
        os.makedirs(data_dir, exist_ok=True)
        self.path = os.path.join(data_dir, "feedback.json")

    def load(self) -> list:
        if not os.path.exists(self.path):
            return []
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, list) else []
        except (json.JSONDecodeError, OSError):
            return []

    def add(self, entry: dict) -> list:
        items = [entry] + self.load()
        items = items[:FEEDBACK_CAP]
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
        return items

class MemoryFeedbackStore(FeedbackStore):
    def __init__(self, memory_id: str, http, actor_id: str = "review-radar"):
        self.memory_id = memory_id
        self.http = http
        self.actor_id = actor_id

    def load(self) -> list:
        events = self.http.list_events(self.memory_id, self.actor_id, _SESS_FEEDBACK)
        if not events:
            return []
        try:
            data = _json.loads(events[-1]["content"])
            return data if isinstance(data, list) else []
        except (ValueError, KeyError):
            return []

    def add(self, entry: dict) -> list:
        items = [entry] + self.load()
        items = items[:FEEDBACK_CAP]
        self.http.post_event(self.memory_id, self.actor_id, _SESS_FEEDBACK,
                             _json.dumps(items, ensure_ascii=False))
        return items


# ---- Factories -------------------------------------------------------------

def _memory_http(cfg):
    from memory_http import MemoryHTTP
    return MemoryHTTP(cfg.memory_base_url)

def get_feedback_store(cfg=None) -> FeedbackStore:
    """Factory: the global feedback log chosen by config backend."""
    from config import get_config
    cfg = cfg or get_config()
    if cfg.store_backend == "memory":
        return MemoryFeedbackStore(memory_id=cfg.memory_id, http=_memory_http(cfg))
    return LocalFeedbackStore()

def get_store(app_id: str = None, cfg=None):
    """Factory: a Store (optionally scoped to one app) chosen by config backend."""
    from config import get_config
    cfg = cfg or get_config()
    if cfg.store_backend == "memory":
        return MemoryStore(memory_id=cfg.memory_id, http=_memory_http(cfg), app_id=app_id)
    return LocalStore(app_id=app_id)

def get_registry(cfg=None) -> Registry:
    """Factory: the app Registry chosen by config backend."""
    from config import get_config
    cfg = cfg or get_config()
    if cfg.store_backend == "memory":
        return MemoryRegistry(memory_id=cfg.memory_id, http=_memory_http(cfg))
    return LocalRegistry()
