import json
import os
from abc import ABC, abstractmethod

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
    @abstractmethod
    def load_todos(self) -> list: ...
    @abstractmethod
    def save_todos(self, todos: list): ...
    @abstractmethod
    def reset(self): ...

class LocalStore(Store):
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        os.makedirs(data_dir, exist_ok=True)

    def _path(self, name: str) -> str:
        return os.path.join(self.data_dir, name)

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

    def reset(self):
        for name in ("processed_ids.json", "reviews.json", "todos.json"):
            path = self._path(name)
            if os.path.exists(path):
                os.remove(path)

import json as _json

# Session ids used as state keys inside the single Memory store
_SESS_CONFIG = "rr-config"
_SESS_IDS = "rr-processed-ids"
_SESS_REVIEWS = "rr-reviews"
_SESS_TODOS = "rr-todos"

class MemoryStore(Store):
    def __init__(self, memory_id: str, actor_id: str = "review-radar", http=None):
        self.memory_id = memory_id
        self.actor_id = actor_id
        self.http = http  # object with post_event / list_events; real one set by get_store

    def _save_doc(self, session: str, value):
        self.http.post_event(
            self.memory_id, self.actor_id, session, _json.dumps(value, ensure_ascii=False)
        )

    def _load_doc(self, session: str, default):
        events = self.http.list_events(self.memory_id, self.actor_id, session)
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

    def load_reviews(self) -> list:
        return self._load_doc(_SESS_REVIEWS, [])

    def append_reviews(self, reviews: list):
        existing = self.load_reviews()
        existing.extend(reviews)
        self._save_doc(_SESS_REVIEWS, existing)

    def load_todos(self) -> list:
        return self._load_doc(_SESS_TODOS, [])

    def save_todos(self, todos: list):
        self._save_doc(_SESS_TODOS, todos)

    def reset(self):
        self._save_doc(_SESS_IDS, [])
        self._save_doc(_SESS_REVIEWS, [])
        self._save_doc(_SESS_TODOS, [])

def get_store(cfg=None):
    """Factory: choose backend from config. Lazily builds the real HTTP client."""
    from config import get_config
    cfg = cfg or get_config()
    if cfg.store_backend == "memory":
        from memory_http import MemoryHTTP
        return MemoryStore(
            memory_id=cfg.memory_id,
            http=MemoryHTTP(cfg.memory_base_url),
        )
    return LocalStore()
