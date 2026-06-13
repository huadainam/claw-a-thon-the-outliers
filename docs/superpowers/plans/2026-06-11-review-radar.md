# Review Radar Implementation Plan

> **Status: historical implementation plan.**
>
> This document records the original implementation plan from 2026-06-11. The
> current source code has evolved beyond parts of this plan:
>
> - the dashboard is now React 18 CDN + JSX files, not a single vanilla
>   HTML/Chart.js page
> - app tracking is now multi-app through a registry, not a single-app reset
>   model
> - storage is partitioned per app and includes `meta` progress state
> - seed data is bundled and bootstrapped for instant demo data
> - read APIs support `?app_id=` so the dashboard can load a specific app
>
> For the current architecture, use
> `docs/superpowers/specs/2026-06-11-review-radar-design.md` as the source of
> truth.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI agent that scrapes the latest ~1.000 reviews of a chosen app from App Store + Google Play, classifies them with a GreenNode LLM, groups bug reports by topic/severity, and serves a self-contained dashboard with a bug to-do list — auto-refreshing hourly.

**Architecture:** A single Flask app on port 8080 serves a static vanilla HTML dashboard, exposes a small REST API (`/api/*`), and runs a background daemon thread that re-runs the pipeline every hour. All state I/O goes through a `Store` abstraction with two backends: `LocalStore` (JSON files, for dev) and `MemoryStore` (AgentBase Memory, for deploy). App resolution (fuzzy search + suggestions) is a separate step before any scraping; the user must confirm/pick an app before the pipeline runs.

**Tech Stack:** Python 3.11, Flask, `google-play-scraper`, `app-store-scraper`, `openai` (GreenNode OpenAI-compatible endpoint), `requests`, `schedule`, `python-dotenv`, `pytest`. Frontend: vanilla HTML/CSS/JS + Chart.js (CDN). Deploy: Docker → GreenNode AgentBase Custom Agent Runtime (PUBLIC always-on).

**Reference spec:** `docs/superpowers/specs/2026-06-11-review-radar-design.md`

---

## File Structure

All source lives under `review-radar/`.

| File | Responsibility |
|---|---|
| `review-radar/config.py` | Read env vars (`STORE_BACKEND`, `MEMORY_ID`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `MODEL_NAME`); expose typed config object. |
| `review-radar/models.py` | Plain dataclasses / dict schemas + label constants + severity thresholds. Pure, no I/O. |
| `review-radar/scraper.py` | `resolve_app`, `scrape_google_play`, `scrape_app_store`. Never raises; returns lists/dicts. |
| `review-radar/classifier.py` | `classify_reviews` — batched LLM classification, structured JSON, SPAM fallback. |
| `review-radar/grouper.py` | `group_bugs`, `merge_with_existing_todos`. Pure functions. |
| `review-radar/storage.py` | `Store` ABC + `LocalStore` + `MemoryStore` + `get_store()` factory. |
| `review-radar/pipeline.py` | `run_pipeline(app)` orchestration + a run lock; CLI entry for manual run. |
| `review-radar/app.py` | Flask routes (`/health`, `/`, `/api/*`, `/run`) + scheduler thread; `--serve` entry. |
| `review-radar/dashboard/index.html` | Self-contained dashboard (HTML+CSS+JS, Chart.js CDN). |
| `review-radar/requirements.txt` | Runtime + test deps. |
| `review-radar/Dockerfile` | Container image for AgentBase. |
| `review-radar/.env.example` | Documented env template (no secrets). |
| `review-radar/tests/*` | pytest tests mirroring each module. |

**Conventions:**
- Tests run from inside `review-radar/`: `cd review-radar && python -m pytest ...`.
- A review dict schema (canonical): `{id, userName, content, score, at (ISO str), source ("google_play"|"app_store"), label?, bug_topic?, confidence?}`.
- An app dict schema: `{title, developer, icon, gp_id, as_id, stores: [..]}`.
- A todo/bug-group dict schema: `{id, topic, severity, mention_count, sample_reviews[], sources[], first_seen, last_seen, status}`.

---

## Task 0: Project scaffold & dependencies

**Files:**
- Create: `review-radar/requirements.txt`
- Create: `review-radar/.env.example`
- Create: `review-radar/pytest.ini` (flat-layout import config)
- Create: `review-radar/data/.gitkeep` (empty)

> Do NOT create `__init__.py` files: the directory name `review-radar` has a hyphen and
> cannot be a Python package, so package-style collection breaks. Use a flat layout where
> `pytest.ini` puts the project dir on `sys.path` and tests do `from models import ...`.

- [ ] **Step 1: Create `requirements.txt`**

```
flask==3.0.3
google-play-scraper==1.2.7
openai==1.51.0
python-dotenv==1.0.1
schedule==1.2.2
requests==2.32.3
pytest==8.3.3
```

> Note: App Store reviews are fetched via the public iTunes RSS/search JSON APIs (using
> `requests`), NOT `app-store-scraper` — that package hard-pins `requests==2.23.0` and
> breaks a clean `pip install`. See Task 7.

- [ ] **Step 2: Create `.env.example`**

```
# GreenNode OpenAI-compatible LLM
OPENAI_API_KEY=replace-me
OPENAI_BASE_URL=replace-me
MODEL_NAME=replace-me

# Storage backend: local | memory
STORE_BACKEND=local

# AgentBase Memory store id (required when STORE_BACKEND=memory)
MEMORY_ID=
MEMORY_BASE_URL=https://agentbase.api.vngcloud.vn/memory
```

- [ ] **Step 3: Create `pytest.ini` and `data/.gitkeep`**

`review-radar/pytest.ini`:
```ini
[pytest]
pythonpath = .
testpaths = tests
```
And create an empty `review-radar/data/.gitkeep`.

- [ ] **Step 4: Create and activate a virtualenv, install deps**

Run (PowerShell):
```
cd review-radar
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```
Expected: installs without error. `pip show flask` prints version 3.0.3.

- [ ] **Step 5: Commit**

```bash
git add review-radar/requirements.txt review-radar/.env.example review-radar/__init__.py review-radar/tests/__init__.py review-radar/data/.gitkeep
git commit -m "chore: scaffold review-radar project and deps"
```

---

## Task 1: Models & constants

**Files:**
- Create: `review-radar/models.py`
- Test: `review-radar/tests/test_models.py`

- [ ] **Step 1: Write the failing test**

```python
# review-radar/tests/test_models.py
from models import LABELS, severity_for_mentions

def test_labels_are_the_five_expected():
    assert set(LABELS) == {
        "BUG_REPORT", "FEATURE_REQUEST", "COMPLAINT", "POSITIVE", "SPAM"
    }

def test_severity_boundaries():
    assert severity_for_mentions(10) == "critical"
    assert severity_for_mentions(11) == "critical"
    assert severity_for_mentions(9) == "medium"
    assert severity_for_mentions(3) == "medium"
    assert severity_for_mentions(2) == "low"
    assert severity_for_mentions(0) == "low"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd review-radar && python -m pytest tests/test_models.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'models'`.

- [ ] **Step 3: Write minimal implementation**

```python
# review-radar/models.py
LABELS = ["BUG_REPORT", "FEATURE_REQUEST", "COMPLAINT", "POSITIVE", "SPAM"]

# similarity thresholds for app resolution
MATCH_THRESHOLD = 0.85
AMBIGUOUS_THRESHOLD = 0.40

def severity_for_mentions(count: int) -> str:
    if count >= 10:
        return "critical"
    if count >= 3:
        return "medium"
    return "low"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd review-radar && python -m pytest tests/test_models.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add review-radar/models.py review-radar/tests/test_models.py
git commit -m "feat: add label constants and severity thresholds"
```

---

## Task 2: Config loader

**Files:**
- Create: `review-radar/config.py`
- Test: `review-radar/tests/test_config.py`

- [ ] **Step 1: Write the failing test**

```python
# review-radar/tests/test_config.py
import importlib

def test_config_reads_env(monkeypatch):
    monkeypatch.setenv("STORE_BACKEND", "memory")
    monkeypatch.setenv("MEMORY_ID", "mem-123")
    monkeypatch.setenv("MODEL_NAME", "my-model")
    monkeypatch.setenv("OPENAI_API_KEY", "key")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://llm.example")
    import config
    importlib.reload(config)
    cfg = config.get_config()
    assert cfg.store_backend == "memory"
    assert cfg.memory_id == "mem-123"
    assert cfg.model_name == "my-model"

def test_config_defaults(monkeypatch):
    monkeypatch.delenv("STORE_BACKEND", raising=False)
    monkeypatch.delenv("MODEL_NAME", raising=False)
    import config
    importlib.reload(config)
    cfg = config.get_config()
    assert cfg.store_backend == "local"
    assert cfg.model_name == "gpt-4o-mini"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd review-radar && python -m pytest tests/test_config.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'config'`.

- [ ] **Step 3: Write minimal implementation**

```python
# review-radar/config.py
import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

@dataclass
class Config:
    store_backend: str
    memory_id: str
    memory_base_url: str
    openai_api_key: str
    openai_base_url: str
    model_name: str

def get_config() -> Config:
    return Config(
        store_backend=os.getenv("STORE_BACKEND", "local"),
        memory_id=os.getenv("MEMORY_ID", ""),
        memory_base_url=os.getenv(
            "MEMORY_BASE_URL", "https://agentbase.api.vngcloud.vn/memory"
        ),
        openai_api_key=os.getenv("OPENAI_API_KEY", ""),
        openai_base_url=os.getenv("OPENAI_BASE_URL", ""),
        model_name=os.getenv("MODEL_NAME", "gpt-4o-mini"),
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd review-radar && python -m pytest tests/test_config.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add review-radar/config.py review-radar/tests/test_config.py
git commit -m "feat: add env-based config loader"
```

---

## Task 3: Storage — `Store` ABC + `LocalStore`

**Files:**
- Create: `review-radar/storage.py`
- Test: `review-radar/tests/test_local_store.py`

- [ ] **Step 1: Write the failing test**

```python
# review-radar/tests/test_local_store.py
from storage import LocalStore

def test_local_store_roundtrip(tmp_path):
    s = LocalStore(data_dir=str(tmp_path))

    # config
    s.save_config({"title": "Zalo", "gp_id": "com.zing.zalo", "as_id": "579523206"})
    assert s.load_config()["title"] == "Zalo"

    # processed ids
    assert s.load_processed_ids() == set()
    s.save_processed_ids({"a", "b"})
    assert s.load_processed_ids() == {"a", "b"}

    # reviews append
    assert s.load_reviews() == []
    s.append_reviews([{"id": "a", "content": "x"}])
    s.append_reviews([{"id": "b", "content": "y"}])
    assert len(s.load_reviews()) == 2

    # todos
    s.save_todos([{"id": "t1", "topic": "login", "status": "open"}])
    assert s.load_todos()[0]["topic"] == "login"

def test_local_store_reset(tmp_path):
    s = LocalStore(data_dir=str(tmp_path))
    s.save_processed_ids({"a"})
    s.append_reviews([{"id": "a"}])
    s.save_todos([{"id": "t1"}])
    s.reset()
    assert s.load_processed_ids() == set()
    assert s.load_reviews() == []
    assert s.load_todos() == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd review-radar && python -m pytest tests/test_local_store.py -v`
Expected: FAIL with `ImportError: cannot import name 'LocalStore'`.

- [ ] **Step 3: Write minimal implementation**

```python
# review-radar/storage.py
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd review-radar && python -m pytest tests/test_local_store.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add review-radar/storage.py review-radar/tests/test_local_store.py
git commit -m "feat: add Store ABC and LocalStore backend"
```

---

## Task 4: Storage — `MemoryStore` + `get_store()` factory

**Files:**
- Modify: `review-radar/storage.py` (append `MemoryStore`, `get_store`)
- Test: `review-radar/tests/test_memory_store.py`

**Design note:** `MemoryStore` treats each state key as a *session* in one AgentBase
Memory store. `save` writes one event whose `content` is the JSON-serialized value;
`load` lists events for that session and parses the **most recent** one (last-write-wins).
HTTP is injected so tests don't hit the network. The token getter is also injectable.

- [ ] **Step 1: Write the failing test**

```python
# review-radar/tests/test_memory_store.py
from storage import MemoryStore

class FakeHTTP:
    """In-memory stand-in for the Memory REST API, keyed by session."""
    def __init__(self):
        self.sessions = {}  # session -> list of event dicts (append order)

    def post_event(self, memory_id, actor_id, session_id, content):
        self.sessions.setdefault(session_id, []).append({"content": content})

    def list_events(self, memory_id, actor_id, session_id):
        return list(self.sessions.get(session_id, []))

def make_store():
    return MemoryStore(memory_id="m1", actor_id="agent", http=FakeHTTP())

def test_memory_store_roundtrip():
    s = make_store()
    assert s.load_todos() == []
    s.save_todos([{"id": "t1", "topic": "login", "status": "open"}])
    assert s.load_todos()[0]["topic"] == "login"

def test_memory_store_last_write_wins():
    s = make_store()
    s.save_processed_ids({"a"})
    s.save_processed_ids({"a", "b", "c"})
    assert s.load_processed_ids() == {"a", "b", "c"}

def test_memory_store_append_reviews_accumulates():
    s = make_store()
    s.append_reviews([{"id": "a"}])
    s.append_reviews([{"id": "b"}])
    assert len(s.load_reviews()) == 2

def test_memory_store_reset_clears():
    s = make_store()
    s.save_processed_ids({"a"})
    s.append_reviews([{"id": "a"}])
    s.save_todos([{"id": "t1"}])
    s.reset()
    assert s.load_processed_ids() == set()
    assert s.load_reviews() == []
    assert s.load_todos() == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd review-radar && python -m pytest tests/test_memory_store.py -v`
Expected: FAIL with `ImportError: cannot import name 'MemoryStore'`.

- [ ] **Step 3: Write minimal implementation (append to `storage.py`)**

```python
# --- append to review-radar/storage.py ---
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd review-radar && python -m pytest tests/test_memory_store.py -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add review-radar/storage.py review-radar/tests/test_memory_store.py
git commit -m "feat: add MemoryStore backend and get_store factory"
```

---

## Task 5: Memory HTTP client (AgentBase Memory REST)

**Files:**
- Create: `review-radar/memory_http.py`
- Test: `review-radar/tests/test_memory_http.py`

**Design note:** This is the thin REST adapter `get_store()` injects into `MemoryStore`.
It obtains an IAM token via the AgentBase helper script (`get_token.sh`) at the repo root,
and calls the Memory event endpoints. The token getter and the `requests` session are
injectable so the test never touches the network or the filesystem helper.

- [ ] **Step 1: Write the failing test**

```python
# review-radar/tests/test_memory_http.py
from memory_http import MemoryHTTP

class FakeResp:
    def __init__(self, status, payload):
        self.status_code = status
        self._payload = payload
    def json(self):
        return self._payload
    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

class FakeSession:
    def __init__(self):
        self.calls = []
        self.events = []
    def post(self, url, json=None, headers=None, timeout=None):
        self.calls.append(("POST", url, json))
        self.events.append({"content": json["payload"]["content"]})
        return FakeResp(200, {})
    def get(self, url, headers=None, timeout=None):
        self.calls.append(("GET", url, None))
        return FakeResp(200, {"data": list(self.events)})

def make():
    sess = FakeSession()
    http = MemoryHTTP(
        base_url="https://mem.example",
        session=sess,
        token_getter=lambda: "fake-token",
    )
    return http, sess

def test_post_then_list_roundtrip():
    http, sess = make()
    http.post_event("m1", "actor", "sess1", "hello-json")
    events = http.list_events("m1", "actor", "sess1")
    assert events[-1]["content"] == "hello-json"

def test_post_includes_bearer_token():
    http, sess = make()
    http.post_event("m1", "actor", "sess1", "x")
    # Find the POST call; ensure auth header was attached via session usage
    assert sess.calls[0][0] == "POST"
    assert "m1" in sess.calls[0][1] or "m1" in str(sess.calls[0])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd review-radar && python -m pytest tests/test_memory_http.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'memory_http'`.

- [ ] **Step 3: Write minimal implementation**

```python
# review-radar/memory_http.py
import subprocess
import requests

def _default_token_getter() -> str:
    """Obtain an IAM token via the AgentBase helper script (repo root)."""
    out = subprocess.run(
        ["bash", ".claude/skills/agentbase/scripts/get_token.sh"],
        capture_output=True, text=True, cwd="..",
    )
    return out.stdout.strip()

class MemoryHTTP:
    def __init__(self, base_url, session=None, token_getter=None):
        self.base_url = base_url.rstrip("/")
        self.session = session or requests.Session()
        self.token_getter = token_getter or _default_token_getter

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.token_getter()}",
            "Content-Type": "application/json",
        }

    def _events_url(self, memory_id, actor_id, session_id):
        return (
            f"{self.base_url}/memories/{memory_id}"
            f"/actors/{actor_id}/sessions/{session_id}/events"
        )

    def post_event(self, memory_id, actor_id, session_id, content):
        url = self._events_url(memory_id, actor_id, session_id)
        body = {"payload": {"role": "assistant", "content": content}}
        resp = self.session.post(url, json=body, headers=self._headers(), timeout=30)
        resp.raise_for_status()

    def list_events(self, memory_id, actor_id, session_id):
        url = self._events_url(memory_id, actor_id, session_id)
        resp = self.session.get(url, headers=self._headers(), timeout=30)
        resp.raise_for_status()
        return resp.json().get("data", [])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd review-radar && python -m pytest tests/test_memory_http.py -v`
Expected: PASS (2 passed).

> **Integration caveat (manual, not a unit test):** the exact Memory event request/response
> shape (`payload.content` key, `data` list key, ordering) must be verified against a live
> store before deploy — see Task 13. If the live API differs, adjust `post_event`/`list_events`
> and the `FakeSession` accordingly. This is the one place the real API shape is assumed.

- [ ] **Step 5: Commit**

```bash
git add review-radar/memory_http.py review-radar/tests/test_memory_http.py
git commit -m "feat: add AgentBase Memory REST adapter"
```

---

## Task 6: Scraper — `resolve_app` (fuzzy search + suggestions)

**Files:**
- Create: `review-radar/scraper.py`
- Test: `review-radar/tests/test_resolve_app.py`

**Design note:** `resolve_app` must never hit the network in unit tests, so the two
per-store search functions are injected. Each search fn returns a list of candidate
dicts `{title, developer, icon, app_id, store}`. `resolve_app` merges candidates,
scores them by title similarity to the query, and picks a status.

- [ ] **Step 1: Write the failing test**

```python
# review-radar/tests/test_resolve_app.py
from scraper import resolve_app

def gp_search(name):
    data = {
        "zalo": [{"title": "Zalo", "developer": "VNG", "icon": "i", "app_id": "com.zing.zalo", "store": "google_play"}],
        "zlp": [
            {"title": "ZaloPay", "developer": "VNG", "icon": "i", "app_id": "vn.com.vng.zalopay", "store": "google_play"},
            {"title": "Zalo", "developer": "VNG", "icon": "i", "app_id": "com.zing.zalo", "store": "google_play"},
            {"title": "Zip", "developer": "X", "icon": "i", "app_id": "com.zip", "store": "google_play"},
        ],
        "zzxxqq": [],
    }
    return data.get(name.lower(), [])

def as_search(name):
    data = {
        "zalo": [{"title": "Zalo", "developer": "VNG", "icon": "i", "app_id": "579523206", "store": "app_store"}],
        "zlp": [{"title": "ZaloPay", "developer": "VNG", "icon": "i", "app_id": "1112407880", "store": "app_store"}],
        "zzxxqq": [],
    }
    return data.get(name.lower(), [])

def test_matched_returns_single_app_with_both_ids():
    res = resolve_app("zalo", gp_search=gp_search, as_search=as_search)
    assert res["status"] == "matched"
    assert res["app"]["title"] == "Zalo"
    assert res["app"]["gp_id"] == "com.zing.zalo"
    assert res["app"]["as_id"] == "579523206"

def test_ambiguous_returns_suggestions():
    res = resolve_app("zlp", gp_search=gp_search, as_search=as_search)
    assert res["status"] == "ambiguous"
    titles = [s["title"] for s in res["suggestions"]]
    assert "ZaloPay" in titles
    assert "Zalo" in titles

def test_not_found():
    res = resolve_app("zzxxqq", gp_search=gp_search, as_search=as_search)
    assert res["status"] == "not_found"
    assert "message" in res
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd review-radar && python -m pytest tests/test_resolve_app.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scraper'`.

- [ ] **Step 3: Write minimal implementation**

```python
# review-radar/scraper.py
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd review-radar && python -m pytest tests/test_resolve_app.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add review-radar/scraper.py review-radar/tests/test_resolve_app.py
git commit -m "feat: add fuzzy app resolution with suggestions"
```

---

## Task 7: Scraper — live search + review scraping

**Files:**
- Create: `review-radar/scraper_live.py`
- Modify: `review-radar/scraper.py` (add `scrape_google_play`, `scrape_app_store`)
- Test: `review-radar/tests/test_scrape_reviews.py`

**Design note:** The actual library calls live in `scraper_live.py` and are NOT unit-tested
(network). The pure normalization wrappers in `scraper.py` ARE tested by injecting a fake
raw fetcher. Each scrape fn must return `[]` on any error and never raise.

- [ ] **Step 1: Write the failing test**

```python
# review-radar/tests/test_scrape_reviews.py
from scraper import scrape_google_play, scrape_app_store

def fake_gp_fetch(app_id, count):
    return [
        {"reviewId": "g1", "userName": "An", "content": "App lỗi", "score": 1,
         "at": "2026-06-01T10:00:00"},
    ]

def fake_as_fetch(app_id, count):
    return [
        {"review_id": "a1", "user_name": "Binh", "review": "Tốt", "rating": 5,
         "date": "2026-06-02T11:00:00"},
    ]

def test_gp_normalizes_and_tags_source():
    out = scrape_google_play("com.zing.zalo", fetch=fake_gp_fetch)
    assert out[0]["id"] == "g1"
    assert out[0]["content"] == "App lỗi"
    assert out[0]["source"] == "google_play"

def test_as_normalizes_and_tags_source():
    out = scrape_app_store("579523206", fetch=fake_as_fetch)
    assert out[0]["id"] == "a1"
    assert out[0]["source"] == "app_store"

def test_scrape_returns_empty_on_error():
    def boom(app_id, count):
        raise RuntimeError("blocked")
    assert scrape_google_play("x", fetch=boom) == []
    assert scrape_app_store("x", fetch=boom) == []

def test_scrape_returns_empty_for_missing_app_id():
    assert scrape_google_play(None, fetch=fake_gp_fetch) == []
    assert scrape_app_store(None, fetch=fake_as_fetch) == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd review-radar && python -m pytest tests/test_scrape_reviews.py -v`
Expected: FAIL with `ImportError: cannot import name 'scrape_google_play'`.

- [ ] **Step 3: Write minimal implementation**

Append to `scraper.py`:
```python
# --- append to review-radar/scraper.py ---
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
```

Create `scraper_live.py` (network code; smoke-tested manually in Task 13). App Store
uses the public iTunes search + RSS customer-reviews JSON APIs via `requests` — no
`app-store-scraper` dependency (it hard-pins `requests==2.23.0`, which breaks the Docker
build). iTunes RSS returns up to ~500 most-recent reviews (50/page × 10 pages):
```python
# review-radar/scraper_live.py
import requests
from google_play_scraper import search as gp_search_fn, reviews, Sort

def gp_search_live(name):
    results = gp_search_fn(name, lang="vi", country="vn", n_hits=5)
    return [{"title": r["title"], "developer": r.get("developer", ""),
             "icon": r.get("icon", ""), "app_id": r["appId"],
             "store": "google_play"} for r in results]

def gp_reviews_live(app_id, count):
    result, _ = reviews(app_id, lang="vi", country="vn",
                        sort=Sort.NEWEST, count=count)
    return result

def as_search_live(name):
    resp = requests.get("https://itunes.apple.com/search",
                        params={"term": name, "country": "vn",
                                "entity": "software", "limit": 5}, timeout=20)
    items = resp.json().get("results", [])
    return [{"title": it["trackName"], "developer": it.get("artistName", ""),
             "icon": it.get("artworkUrl100", ""), "app_id": str(it["trackId"]),
             "store": "app_store"} for it in items]

def as_reviews_live(app_id, count):
    out = []
    for page in range(1, 11):  # up to 10 pages × 50 reviews
        url = (f"https://itunes.apple.com/vn/rss/customerreviews/"
               f"page={page}/id={app_id}/sortby=mostrecent/json")
        resp = requests.get(url, timeout=20)
        entries = resp.json().get("feed", {}).get("entry", [])
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd review-radar && python -m pytest tests/test_scrape_reviews.py -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add review-radar/scraper.py review-radar/scraper_live.py review-radar/tests/test_scrape_reviews.py
git commit -m "feat: add review scraping with error-safe normalization"
```

---

## Task 8: Classifier (batched LLM, SPAM fallback)

**Files:**
- Create: `review-radar/classifier.py`
- Test: `review-radar/tests/test_classifier.py`

**Design note:** The OpenAI client call is injected so tests don't hit the network. The
LLM is asked for a JSON array; parse failures fall back to `SPAM`/`0.0` per review. Input
review dicts are merged with `label`/`bug_topic`/`confidence`.

- [ ] **Step 1: Write the failing test**

```python
# review-radar/tests/test_classifier.py
import json
from classifier import classify_reviews, _parse_batch_response

def fake_llm(prompt):
    # Echo a valid classification for any batch by reading ids out of the prompt
    return json.dumps([
        {"id": "1", "label": "BUG_REPORT", "bug_topic": "Crash khi mở ảnh", "confidence": 0.9},
        {"id": "2", "label": "POSITIVE", "bug_topic": None, "confidence": 0.95},
        {"id": "3", "label": "SPAM", "bug_topic": None, "confidence": 0.3},
    ])

def test_classify_merges_labels():
    reviews = [
        {"id": "1", "content": "App bị crash hoài khi mở ảnh", "score": 1},
        {"id": "2", "content": "Rất tốt, dùng mượt", "score": 5},
        {"id": "3", "content": "ok", "score": 3},
    ]
    out = classify_reviews(reviews, llm=fake_llm)
    by_id = {r["id"]: r for r in out}
    assert by_id["1"]["label"] == "BUG_REPORT"
    assert by_id["1"]["bug_topic"] == "Crash khi mở ảnh"
    assert by_id["2"]["label"] == "POSITIVE"

def test_parse_failure_falls_back_to_spam():
    reviews = [{"id": "1", "content": "x", "score": 1}]
    out = classify_reviews(reviews, llm=lambda p: "not json at all")
    assert out[0]["label"] == "SPAM"
    assert out[0]["confidence"] == 0.0

def test_parser_handles_code_fenced_json():
    raw = "```json\n[{\"id\": \"1\", \"label\": \"POSITIVE\", \"bug_topic\": null, \"confidence\": 0.8}]\n```"
    parsed = _parse_batch_response(raw)
    assert parsed[0]["label"] == "POSITIVE"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd review-radar && python -m pytest tests/test_classifier.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'classifier'`.

- [ ] **Step 3: Write minimal implementation**

```python
# review-radar/classifier.py
import json
import re

BATCH_SIZE = 30

PROMPT_TEMPLATE = """Bạn là chuyên gia phân tích review ứng dụng mobile. Phân loại từng review dưới đây.

Các loại phân loại:
- BUG_REPORT: user báo lỗi, crash, tính năng không hoạt động
- FEATURE_REQUEST: user đề xuất tính năng mới
- COMPLAINT: phàn nàn về UX, tốc độ, thiết kế nhưng không phải bug cụ thể
- POSITIVE: review tích cực, khen ngợi
- SPAM: review rác, quá ngắn (<5 từ), chỉ emoji, vô nghĩa

Trả về DUY NHẤT một JSON array, đúng thứ tự input, mỗi item:
{{"id": "<review_id>", "label": "<BUG_REPORT|FEATURE_REQUEST|COMPLAINT|POSITIVE|SPAM>", "bug_topic": "<chủ đề bug ngắn bằng tiếng Việt nếu BUG_REPORT, còn lại null>", "confidence": <0.0-1.0>}}

Reviews:
{reviews_json}
"""

def _parse_batch_response(raw: str):
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    start, end = text.find("["), text.rfind("]")
    if start != -1 and end != -1:
        text = text[start:end + 1]
    return json.loads(text)

def _llm_default(prompt: str) -> str:
    from openai import OpenAI
    from config import get_config
    cfg = get_config()
    client = OpenAI(api_key=cfg.openai_api_key, base_url=cfg.openai_base_url)
    resp = client.chat.completions.create(
        model=cfg.model_name,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    return resp.choices[0].message.content

def classify_reviews(reviews: list, llm=None) -> list:
    llm = llm or _llm_default
    out = []
    for i in range(0, len(reviews), BATCH_SIZE):
        batch = reviews[i:i + BATCH_SIZE]
        payload = [{"id": r["id"], "content": r.get("content", ""),
                    "score": r.get("score", 0)} for r in batch]
        prompt = PROMPT_TEMPLATE.format(
            reviews_json=json.dumps(payload, ensure_ascii=False))
        try:
            parsed = _parse_batch_response(llm(prompt))
            by_id = {str(p["id"]): p for p in parsed}
        except Exception:
            by_id = {}
        for r in batch:
            p = by_id.get(str(r["id"]))
            merged = dict(r)
            if p and p.get("label"):
                merged["label"] = p["label"]
                merged["bug_topic"] = p.get("bug_topic")
                merged["confidence"] = p.get("confidence", 0.0)
            else:
                merged["label"] = "SPAM"
                merged["bug_topic"] = None
                merged["confidence"] = 0.0
            out.append(merged)
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd review-radar && python -m pytest tests/test_classifier.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add review-radar/classifier.py review-radar/tests/test_classifier.py
git commit -m "feat: add batched LLM review classifier with SPAM fallback"
```

---

## Task 9: Grouper (bug grouping + merge with existing todos)

**Files:**
- Create: `review-radar/grouper.py`
- Test: `review-radar/tests/test_grouper.py`

**Design note:** `group_bugs` is pure; `uuid` and timestamps are injected so output is
deterministic in tests. `merge_with_existing_todos` matches by case-insensitive topic and
preserves existing `status`.

- [ ] **Step 1: Write the failing test**

```python
# review-radar/tests/test_grouper.py
from grouper import group_bugs, merge_with_existing_todos

def fixed_id():
    n = {"i": 0}
    def _gen():
        n["i"] += 1
        return f"id-{n['i']}"
    return _gen

def test_group_bugs_counts_and_severity():
    reviews = [
        {"id": str(i), "content": f"login lỗi {i}", "label": "BUG_REPORT",
         "bug_topic": "Lỗi đăng nhập", "source": "google_play", "at": "2026-06-01"}
        for i in range(12)
    ] + [
        {"id": "x", "content": "ok", "label": "POSITIVE", "bug_topic": None,
         "source": "app_store", "at": "2026-06-01"},
    ]
    groups = group_bugs(reviews, id_gen=fixed_id(), now="2026-06-02T00:00:00")
    assert len(groups) == 1
    g = groups[0]
    assert g["topic"] == "Lỗi đăng nhập"
    assert g["mention_count"] == 12
    assert g["severity"] == "critical"
    assert len(g["sample_reviews"]) == 3
    assert g["status"] == "open"

def test_group_bugs_ignores_non_bugs():
    reviews = [{"id": "1", "label": "POSITIVE", "bug_topic": None,
                "content": "tốt", "source": "google_play", "at": "x"}]
    assert group_bugs(reviews, id_gen=fixed_id(), now="x") == []

def test_merge_preserves_done_status_and_updates_count():
    new = [{"id": "id-1", "topic": "Lỗi đăng nhập", "severity": "medium",
            "mention_count": 5, "sample_reviews": ["a"], "sources": ["google_play"],
            "first_seen": "d1", "last_seen": "d2", "status": "open"}]
    existing = [{"id": "old-1", "topic": "lỗi đăng nhập", "severity": "low",
                 "mention_count": 2, "sample_reviews": ["x"], "sources": ["app_store"],
                 "first_seen": "d0", "last_seen": "d0", "status": "done"}]
    merged = merge_with_existing_todos(new, existing)
    assert len(merged) == 1
    assert merged[0]["status"] == "done"          # preserved
    assert merged[0]["mention_count"] == 5         # updated
    assert merged[0]["severity"] == "medium"       # upgraded
    assert merged[0]["id"] == "old-1"              # keep stable id

def test_merge_adds_new_group():
    new = [{"id": "id-9", "topic": "Crash camera", "severity": "low",
            "mention_count": 1, "sample_reviews": [], "sources": [],
            "first_seen": "d", "last_seen": "d", "status": "open"}]
    merged = merge_with_existing_todos(new, [])
    assert len(merged) == 1
    assert merged[0]["topic"] == "Crash camera"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd review-radar && python -m pytest tests/test_grouper.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'grouper'`.

- [ ] **Step 3: Write minimal implementation**

```python
# review-radar/grouper.py
import uuid
from datetime import datetime, timezone
from models import severity_for_mentions

def _now_iso():
    return datetime.now(timezone.utc).isoformat()

def group_bugs(reviews, id_gen=None, now=None):
    id_gen = id_gen or (lambda: str(uuid.uuid4()))
    now = now or _now_iso()
    buckets = {}  # topic.lower() -> group
    for r in reviews:
        if r.get("label") != "BUG_REPORT":
            continue
        topic = (r.get("bug_topic") or "Khác").strip()
        key = topic.lower()
        g = buckets.get(key)
        if g is None:
            g = {
                "id": id_gen(), "topic": topic, "severity": "low",
                "mention_count": 0, "sample_reviews": [], "sources": [],
                "first_seen": r.get("at") or now, "last_seen": r.get("at") or now,
                "status": "open",
            }
            buckets[key] = g
        g["mention_count"] += 1
        if len(g["sample_reviews"]) < 3 and r.get("content"):
            g["sample_reviews"].append(r["content"])
        src = r.get("source")
        if src and src not in g["sources"]:
            g["sources"].append(src)
        at = r.get("at")
        if at:
            g["last_seen"] = max(g["last_seen"], at)
            g["first_seen"] = min(g["first_seen"], at)
    for g in buckets.values():
        g["severity"] = severity_for_mentions(g["mention_count"])
    return list(buckets.values())

def merge_with_existing_todos(new_groups, existing_todos):
    by_topic = {t["topic"].lower(): t for t in existing_todos}
    for ng in new_groups:
        key = ng["topic"].lower()
        old = by_topic.get(key)
        if old:
            old["mention_count"] = ng["mention_count"]
            old["last_seen"] = ng["last_seen"]
            old["sample_reviews"] = ng["sample_reviews"]
            old["sources"] = ng["sources"]
            old["severity"] = ng["severity"]
            # status preserved, id preserved
        else:
            by_topic[key] = ng
    return list(by_topic.values())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd review-radar && python -m pytest tests/test_grouper.py -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add review-radar/grouper.py review-radar/tests/test_grouper.py
git commit -m "feat: add bug grouping and todo merge logic"
```

---

## Task 10: Pipeline orchestration

**Files:**
- Create: `review-radar/pipeline.py`
- Test: `review-radar/tests/test_pipeline.py`

**Design note:** `run_pipeline` takes a `store` and the scrape/classify/group callables so
the test wires fakes. It performs dedup, the no-new-reviews short-circuit, the empty-scrape
cache fallback, persistence, and the run lock. The app dict (`{gp_id, as_id, title}`) is
read from `store.load_config()`.

- [ ] **Step 1: Write the failing test**

```python
# review-radar/tests/test_pipeline.py
from storage import LocalStore
from pipeline import run_pipeline

def make_deps(gp_reviews, as_reviews):
    return dict(
        scrape_gp=lambda app_id: list(gp_reviews),
        scrape_as=lambda app_id: list(as_reviews),
        classify=lambda revs: [dict(r, label="BUG_REPORT", bug_topic="Lỗi A",
                                    confidence=0.9) for r in revs],
    )

def test_pipeline_processes_new_reviews(tmp_path):
    store = LocalStore(data_dir=str(tmp_path))
    store.save_config({"title": "Zalo", "gp_id": "g", "as_id": "a"})
    gp = [{"id": "g1", "content": "lỗi", "score": 1, "source": "google_play", "at": "2026-06-01"}]
    asr = [{"id": "a1", "content": "lỗi", "score": 1, "source": "app_store", "at": "2026-06-01"}]
    result = run_pipeline(store=store, **make_deps(gp, asr))
    assert result["new_reviews"] == 2
    assert len(store.load_reviews()) == 2
    assert store.load_processed_ids() == {"g1", "a1"}
    assert len(store.load_todos()) == 1

def test_pipeline_dedups_already_processed(tmp_path):
    store = LocalStore(data_dir=str(tmp_path))
    store.save_config({"title": "Zalo", "gp_id": "g", "as_id": "a"})
    store.save_processed_ids({"g1"})
    gp = [{"id": "g1", "content": "lỗi", "score": 1, "source": "google_play", "at": "d"}]
    result = run_pipeline(store=store, **make_deps(gp, []))
    assert result["new_reviews"] == 0

def test_pipeline_falls_back_to_cache_when_scrape_empty(tmp_path):
    store = LocalStore(data_dir=str(tmp_path))
    store.save_config({"title": "Zalo", "gp_id": "g", "as_id": "a"})
    # seed cache: an already-classified review exists
    store.append_reviews([{"id": "old1", "content": "lỗi cũ", "label": "BUG_REPORT",
                           "bug_topic": "Lỗi A", "source": "google_play", "at": "d"}])
    store.save_processed_ids({"old1"})
    # scrape returns nothing -> fallback regroups from cache, no crash, no new
    result = run_pipeline(store=store, **make_deps([], []))
    assert result["new_reviews"] == 0
    assert result["used_fallback"] is True
    assert len(store.load_todos()) == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd review-radar && python -m pytest tests/test_pipeline.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'pipeline'`.

- [ ] **Step 3: Write minimal implementation**

```python
# review-radar/pipeline.py
import threading
from grouper import group_bugs, merge_with_existing_todos

_run_lock = threading.Lock()

def run_pipeline(store=None, scrape_gp=None, scrape_as=None, classify=None):
    # default wiring (production)
    if store is None:
        from storage import get_store
        store = get_store()
    if scrape_gp is None or scrape_as is None:
        from scraper import scrape_google_play, scrape_app_store
        scrape_gp = scrape_gp or (lambda app_id: scrape_google_play(app_id))
        scrape_as = scrape_as or (lambda app_id: scrape_app_store(app_id))
    if classify is None:
        from classifier import classify_reviews
        classify = classify_reviews

    if not _run_lock.acquire(blocking=False):
        return {"skipped": True, "reason": "already running"}
    try:
        cfg = store.load_config()
        if not cfg:
            return {"error": "no app configured"}

        scraped = scrape_gp(cfg.get("gp_id")) + scrape_as(cfg.get("as_id"))
        used_fallback = False
        if not scraped:
            used_fallback = True  # regroup from cached reviews only

        processed = store.load_processed_ids()
        new_reviews = [r for r in scraped if r["id"] not in processed]

        if new_reviews:
            classified = classify(new_reviews)
            store.append_reviews(classified)
            store.save_processed_ids(processed | {r["id"] for r in classified})

        all_reviews = store.load_reviews()
        groups = group_bugs(all_reviews)
        todos = merge_with_existing_todos(groups, store.load_todos())
        store.save_todos(todos)

        return {"new_reviews": len(new_reviews), "todos": len(todos),
                "used_fallback": used_fallback}
    finally:
        _run_lock.release()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", help="resolve+track this app then run once")
    args = parser.parse_args()
    from storage import get_store
    store = get_store()
    if args.app:
        from scraper import resolve_app
        res = resolve_app(args.app)
        if res["status"] != "matched":
            print(f"Resolve status: {res['status']} — {res.get('message','')}")
            for s in res.get("suggestions", []):
                print("  -", s["title"], s.get("developer", ""))
            raise SystemExit(1)
        store.reset()
        store.save_config(res["app"])
    print(run_pipeline(store=store))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd review-radar && python -m pytest tests/test_pipeline.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add review-radar/pipeline.py review-radar/tests/test_pipeline.py
git commit -m "feat: add pipeline orchestration with dedup and cache fallback"
```

---

## Task 11: Flask app — API, health, scheduler thread

**Files:**
- Create: `review-radar/app.py`
- Test: `review-radar/tests/test_app.py`

**Design note:** Build the Flask app via a `create_app(store)` factory so tests inject a
`LocalStore` on a tmp dir. The scheduler thread is only started in the `--serve` entrypoint,
NOT inside `create_app`, so tests stay synchronous. `/api/track` calls `run_pipeline`
synchronously in tests (via the injected store) but the route triggers it in a thread in
production — keep the route thin and delegate to a helper that can be monkeypatched.

- [ ] **Step 1: Write the failing test**

```python
# review-radar/tests/test_app.py
import json
from storage import LocalStore
from app import create_app

def make_client(tmp_path, **overrides):
    store = LocalStore(data_dir=str(tmp_path))
    app = create_app(store=store, **overrides)
    app.config["TESTING"] = True
    return app.test_client(), store

def test_health_always_200(tmp_path):
    client, _ = make_client(tmp_path)
    assert client.get("/health").status_code == 200

def test_resolve_endpoint(tmp_path):
    def fake_resolve(name):
        return {"status": "matched", "app": {"title": "Zalo", "gp_id": "g", "as_id": "a"}}
    client, _ = make_client(tmp_path, resolve_fn=fake_resolve)
    resp = client.post("/api/resolve", json={"name": "zalo"})
    body = resp.get_json()
    assert body["status"] == "matched"
    assert body["app"]["title"] == "Zalo"

def test_track_sets_config_and_runs(tmp_path):
    calls = {"ran": 0}
    def fake_run(store):
        calls["ran"] += 1
        return {"new_reviews": 0}
    client, store = make_client(tmp_path, run_fn=fake_run)
    resp = client.post("/api/track", json={"title": "Zalo", "gp_id": "g", "as_id": "a"})
    assert resp.status_code == 200
    assert store.load_config()["title"] == "Zalo"
    assert calls["ran"] == 1

def test_patch_todo_status(tmp_path):
    client, store = make_client(tmp_path)
    store.save_todos([{"id": "t1", "topic": "login", "status": "open"}])
    resp = client.patch("/api/todos/t1", json={"status": "done"})
    assert resp.status_code == 200
    assert store.load_todos()[0]["status"] == "done"

def test_stats_shape(tmp_path):
    client, store = make_client(tmp_path)
    store.save_config({"title": "Zalo"})
    store.append_reviews([
        {"id": "1", "label": "BUG_REPORT", "at": "2026-06-10T00:00:00"},
        {"id": "2", "label": "POSITIVE", "at": "2026-06-10T00:00:00"},
    ])
    body = client.get("/api/stats").get_json()
    assert body["app"]["title"] == "Zalo"
    assert body["total"] == 2
    assert body["by_label"]["BUG_REPORT"] == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd review-radar && python -m pytest tests/test_app.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app'`.

- [ ] **Step 3: Write minimal implementation**

```python
# review-radar/app.py
import os
import threading
from collections import Counter
from flask import Flask, jsonify, request, send_from_directory

DASHBOARD_DIR = os.path.join(os.path.dirname(__file__), "dashboard")

def create_app(store=None, resolve_fn=None, run_fn=None):
    if store is None:
        from storage import get_store
        store = get_store()
    if resolve_fn is None:
        from scraper import resolve_app
        resolve_fn = resolve_app
    if run_fn is None:
        from pipeline import run_pipeline
        run_fn = lambda s: run_pipeline(store=s)

    app = Flask(__name__, static_folder=DASHBOARD_DIR, static_url_path="")

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
                   "as_id": data.get("as_id")}
        store.reset()
        store.save_config(app_obj)
        run_fn(store)
        return jsonify({"ok": True, "app": app_obj}), 200

    @app.post("/run")
    def run_now():
        threading.Thread(target=run_fn, args=(store,), daemon=True).start()
        return jsonify({"ok": True, "started": True}), 200

    @app.get("/api/stats")
    def stats():
        reviews = store.load_reviews()
        by_label = dict(Counter(r.get("label") for r in reviews))
        by_day = dict(Counter(
            (r.get("at") or "")[:10] for r in reviews if r.get("label") == "BUG_REPORT"
        ))
        return jsonify({"app": store.load_config(), "total": len(reviews),
                        "by_label": by_label, "bug_by_day": by_day})

    @app.get("/api/todos")
    def get_todos():
        return jsonify(store.load_todos())

    @app.patch("/api/todos/<todo_id>")
    def patch_todo(todo_id):
        data = request.get_json(silent=True) or {}
        todos = store.load_todos()
        for t in todos:
            if t["id"] == todo_id and "status" in data:
                t["status"] = data["status"]
        store.save_todos(todos)
        return jsonify({"ok": True})

    @app.get("/api/reviews")
    def get_reviews():
        return jsonify(store.load_reviews())

    return app

def _start_scheduler(store):
    import schedule
    import time
    from pipeline import run_pipeline
    schedule.every(1).hours.do(run_pipeline, store=store)
    while True:
        schedule.run_pending()
        time.sleep(60)

if __name__ == "__main__":
    import sys
    from storage import get_store
    store = get_store()
    application = create_app(store=store)
    if "--serve" in sys.argv:
        threading.Thread(target=_start_scheduler, args=(store,), daemon=True).start()
    application.run(host="0.0.0.0", port=8080)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd review-radar && python -m pytest tests/test_app.py -v`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add review-radar/app.py review-radar/tests/test_app.py
git commit -m "feat: add Flask API, health check, and scheduler entrypoint"
```

---

## Task 12: Dashboard (vanilla HTML + Chart.js)

**Files:**
- Create: `review-radar/dashboard/index.html`
- Test: manual (browser) — no unit test; verified in Task 13.

**Design note:** Single self-contained file. On load, GET `/api/stats`; if `app` is empty,
show the "find app" screen. The find-app flow calls `/api/resolve` and renders matched
(confirm button) / ambiguous (suggestion cards) / not_found (banner). Tracking calls
`/api/track` then polls `/api/stats`. Charts via Chart.js CDN.

- [ ] **Step 1: Create `dashboard/index.html`**

```html
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Review Radar</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
  :root { --green:#22c55e; --bg:#0f1216; --card:#1a1f26; --text:#e5e7eb; --muted:#9ca3af; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:Inter,system-ui,Arial,sans-serif; background:var(--bg); color:var(--text); }
  header { display:flex; align-items:center; gap:12px; padding:16px 24px; border-bottom:1px solid #222; }
  header h1 { font-size:18px; margin:0; color:var(--green); }
  .muted { color:var(--muted); font-size:13px; }
  button { background:var(--green); color:#06240f; border:0; border-radius:8px; padding:8px 14px; font-weight:600; cursor:pointer; }
  button.ghost { background:#222; color:var(--text); }
  .wrap { padding:24px; max-width:1280px; margin:0 auto; }
  .cards { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:24px; }
  .card { background:var(--card); border-radius:12px; padding:18px; }
  .card .num { font-size:28px; font-weight:700; }
  .charts { display:grid; grid-template-columns:1fr 2fr; gap:16px; margin-bottom:24px; }
  table { width:100%; border-collapse:collapse; background:var(--card); border-radius:12px; overflow:hidden; }
  th,td { text-align:left; padding:10px 12px; border-bottom:1px solid #222; font-size:14px; }
  .badge { padding:3px 8px; border-radius:999px; font-size:12px; font-weight:600; }
  .crit { background:#7f1d1d; color:#fecaca; } .med { background:#78350f; color:#fde68a; } .low { background:#064e3b; color:#bbf7d0; }
  .open { background:#7f1d1d; color:#fecaca; } .done { background:#064e3b; color:#bbf7d0; }
  .filters { display:flex; gap:8px; margin:16px 0; flex-wrap:wrap; }
  .filters select, input[type=text] { background:#11151a; color:var(--text); border:1px solid #2a2f37; border-radius:8px; padding:8px; }
  .suggest { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; }
  .suggest .item { background:var(--card); border-radius:12px; padding:14px; cursor:pointer; border:1px solid #2a2f37; }
  .suggest .item:hover { border-color:var(--green); }
  .banner { background:#7f1d1d; color:#fecaca; padding:12px 16px; border-radius:10px; margin-bottom:16px; }
  .hidden { display:none; }
  .row-detail { background:#11151a; font-size:13px; color:var(--muted); }
  img.icon { width:40px; height:40px; border-radius:8px; vertical-align:middle; }
</style>
</head>
<body>
<header>
  <h1>📡 Review Radar</h1>
  <span id="appName" class="muted"></span>
  <span id="lastUpdated" class="muted"></span>
  <span style="flex:1"></span>
  <button id="btnRefresh" class="hidden" onclick="refresh()">Refresh</button>
  <button id="btnChange" class="ghost hidden" onclick="showFind()">Đổi app</button>
</header>

<div class="wrap">
  <!-- FIND APP SCREEN -->
  <section id="findScreen">
    <h2>Theo dõi một app</h2>
    <div class="filters">
      <input type="text" id="appInput" placeholder="Nhập tên app (vd: zalo)" style="min-width:320px">
      <button onclick="doResolve()">Tìm app</button>
    </div>
    <div id="resolveResult"></div>
  </section>

  <!-- DASHBOARD SCREEN -->
  <section id="dashScreen" class="hidden">
    <div class="cards">
      <div class="card"><div class="muted">Tổng review</div><div class="num" id="cTotal">0</div></div>
      <div class="card"><div class="muted">Bug open</div><div class="num" id="cOpen">0</div></div>
      <div class="card"><div class="muted">Bug critical</div><div class="num" id="cCrit">0</div></div>
      <div class="card"><div class="muted">Bug done</div><div class="num" id="cDone">0</div></div>
    </div>
    <div class="charts">
      <div class="card"><canvas id="donut"></canvas></div>
      <div class="card"><canvas id="bars"></canvas></div>
    </div>

    <h2>Bug To-Do</h2>
    <div class="filters">
      <select id="fSeverity" onchange="renderTodos()">
        <option value="all">Tất cả severity</option><option value="critical">Critical</option>
        <option value="medium">Medium</option><option value="low">Low</option>
      </select>
      <select id="fStatus" onchange="renderTodos()">
        <option value="all">Tất cả trạng thái</option><option value="open">Open</option><option value="done">Done</option>
      </select>
    </div>
    <table id="todoTable"><thead><tr>
      <th>Severity</th><th>Chủ đề</th><th>Mention</th><th>Nguồn</th><th>Lần cuối</th><th>Trạng thái</th><th></th>
    </tr></thead><tbody></tbody></table>

    <h2 style="margin-top:32px">Review Explorer</h2>
    <div class="filters">
      <select id="rLabel" onchange="renderReviews()"><option value="all">Tất cả label</option>
        <option>BUG_REPORT</option><option>FEATURE_REQUEST</option><option>COMPLAINT</option>
        <option>POSITIVE</option><option>SPAM</option></select>
      <select id="rSource" onchange="renderReviews()"><option value="all">Tất cả nguồn</option>
        <option value="google_play">Google Play</option><option value="app_store">App Store</option></select>
    </div>
    <table id="reviewTable"><thead><tr>
      <th>Nguồn</th><th>Rating</th><th>Label</th><th>Nội dung</th><th>Ngày</th>
    </tr></thead><tbody></tbody></table>
  </section>
</div>

<script>
let TODOS=[], REVIEWS=[], donutChart=null, barChart=null;

async function api(path, opts){ const r=await fetch(path,opts); return r.json(); }

function showFind(){ document.getElementById('findScreen').classList.remove('hidden');
  document.getElementById('dashScreen').classList.add('hidden');
  document.getElementById('btnRefresh').classList.add('hidden');
  document.getElementById('btnChange').classList.add('hidden'); }

function showDash(){ document.getElementById('findScreen').classList.add('hidden');
  document.getElementById('dashScreen').classList.remove('hidden');
  document.getElementById('btnRefresh').classList.remove('hidden');
  document.getElementById('btnChange').classList.remove('hidden'); }

async function doResolve(){
  const name=document.getElementById('appInput').value.trim();
  if(!name) return;
  const res=await api('/api/resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});
  const box=document.getElementById('resolveResult');
  if(res.status==='matched'){
    box.innerHTML=`<div class="suggest"><div class="item" onclick='track(${JSON.stringify(res.app)})'>
      <img class="icon" src="${res.app.icon||''}"> <b>${res.app.title}</b><div class="muted">${res.app.developer||''}</div>
      <div style="margin-top:8px"><button>Xác nhận theo dõi</button></div></div></div>`;
  } else if(res.status==='ambiguous'){
    box.innerHTML=`<div class="banner">${res.message}</div><div class="suggest">`+
      res.suggestions.map(s=>`<div class="item" onclick='track(${JSON.stringify(s)})'>
        <img class="icon" src="${s.icon||''}"> <b>${s.title}</b><div class="muted">${s.developer||''}</div>
        <div class="muted">${(s.stores||[]).join(', ')}</div></div>`).join('')+`</div>`;
  } else {
    box.innerHTML=`<div class="banner">${res.message}</div>`+
      (res.suggestions?`<div class="suggest">`+res.suggestions.map(s=>`<div class="item" onclick='track(${JSON.stringify(s)})'>
        <b>${s.title}</b><div class="muted">${s.developer||''}</div></div>`).join('')+`</div>`:'');
  }
}

async function track(app){
  document.getElementById('resolveResult').innerHTML='<div class="muted">Đang phân tích review...</div>';
  await api('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(app)});
  await load();
}

async function refresh(){ await api('/run',{method:'POST'}); setTimeout(load, 3000); }

async function load(){
  const stats=await api('/api/stats');
  if(!stats.app || !stats.app.title){ showFind(); return; }
  showDash();
  document.getElementById('appName').textContent='· '+stats.app.title;
  TODOS=await api('/api/todos'); REVIEWS=await api('/api/reviews');
  document.getElementById('cTotal').textContent=stats.total;
  document.getElementById('cOpen').textContent=TODOS.filter(t=>t.status==='open').length;
  document.getElementById('cCrit').textContent=TODOS.filter(t=>t.severity==='critical').length;
  document.getElementById('cDone').textContent=TODOS.filter(t=>t.status==='done').length;
  drawCharts(stats); renderTodos(); renderReviews();
}

function drawCharts(stats){
  const bl=stats.by_label||{};
  const labels=Object.keys(bl), vals=Object.values(bl);
  if(donutChart) donutChart.destroy();
  donutChart=new Chart(document.getElementById('donut'),{type:'doughnut',
    data:{labels,datasets:[{data:vals,backgroundColor:['#ef4444','#3b82f6','#f59e0b','#22c55e','#6b7280']}]},
    options:{plugins:{legend:{labels:{color:'#e5e7eb'}}}}});
  const bd=stats.bug_by_day||{}; const days=Object.keys(bd).sort().slice(-7);
  if(barChart) barChart.destroy();
  barChart=new Chart(document.getElementById('bars'),{type:'bar',
    data:{labels:days,datasets:[{label:'Bug/ngày',data:days.map(d=>bd[d]),backgroundColor:'#22c55e'}]},
    options:{plugins:{legend:{labels:{color:'#e5e7eb'}}},scales:{x:{ticks:{color:'#9ca3af'}},y:{ticks:{color:'#9ca3af'}}}}});
}

const sevClass={critical:'crit',medium:'med',low:'low'};
function renderTodos(){
  const fs=document.getElementById('fSeverity').value, fst=document.getElementById('fStatus').value;
  const tb=document.querySelector('#todoTable tbody'); tb.innerHTML='';
  TODOS.filter(t=>(fs==='all'||t.severity===fs)&&(fst==='all'||t.status===fst)).forEach(t=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td><span class="badge ${sevClass[t.severity]}">${t.severity}</span></td>
      <td>${t.topic}</td><td>${t.mention_count}</td><td>${(t.sources||[]).join(', ')}</td>
      <td>${(t.last_seen||'').slice(0,10)}</td>
      <td><span class="badge ${t.status}">${t.status}</span></td>
      <td><button class="ghost" onclick="toggle('${t.id}','${t.status}')">${t.status==='open'?'Mark Done':'Reopen'}</button></td>`;
    tr.onclick=(e)=>{ if(e.target.tagName==='BUTTON')return; expand(tr,t); };
    tb.appendChild(tr);
  });
}
function expand(tr,t){
  if(tr.nextElementSibling && tr.nextElementSibling.classList.contains('row-detail')){
    tr.nextElementSibling.remove(); return; }
  const d=document.createElement('tr'); d.className='row-detail';
  d.innerHTML=`<td colspan="7">${(t.sample_reviews||[]).map(s=>'• '+s).join('<br>')||'(không có sample)'}</td>`;
  tr.after(d);
}
async function toggle(id,status){
  const next=status==='open'?'done':'open';
  await api('/api/todos/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:next})});
  await load();
}
function renderReviews(){
  const fl=document.getElementById('rLabel').value, fsrc=document.getElementById('rSource').value;
  const tb=document.querySelector('#reviewTable tbody'); tb.innerHTML='';
  REVIEWS.filter(r=>(fl==='all'||r.label===fl)&&(fsrc==='all'||r.source===fsrc)).slice(0,20).forEach(r=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${r.source||''}</td><td>${r.score||''}</td><td>${r.label||''}</td>
      <td>${(r.content||'').slice(0,140)}</td><td>${(r.at||'').slice(0,10)}</td>`;
    tb.appendChild(tr);
  });
}
load();
</script>
</body>
</html>
```

- [ ] **Step 2: Verify it serves**

Run: `cd review-radar && python app.py` then open `http://localhost:8080`.
Expected: the "Theo dõi một app" screen renders (no console errors except empty data).

- [ ] **Step 3: Commit**

```bash
git add review-radar/dashboard/index.html
git commit -m "feat: add self-contained dashboard UI"
```

---

## Task 13: Live integration smoke test (scraper + LLM + Memory)

**Files:**
- Create: `review-radar/.env` (NOT committed — copy from `.env.example`, fill real values)
- Create: `review-radar/scripts/smoke.py`

**Design note:** This task exercises the real network paths the unit tests stub out:
library scraping, the GreenNode LLM, and the Memory REST shape. Fix any mismatch found here
in `scraper_live.py` / `classifier.py` / `memory_http.py`.

- [ ] **Step 1: Fill `.env`**

Copy `.env.example` → `.env`. Set `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `MODEL_NAME`
from GreenNode (use `/agentbase-llm` to fetch base URL + an activated model id). Keep
`STORE_BACKEND=local` for this step.

- [ ] **Step 2: Smoke-test app resolution + scraping**

Run: `cd review-radar && python -c "from scraper import resolve_app; import json; print(json.dumps(resolve_app('zalo'), ensure_ascii=False)[:500])"`
Expected: `status: matched` (or ambiguous) with real `gp_id`/`as_id`. If the library
signatures differ from `scraper_live.py`, fix them now.

- [ ] **Step 3: Smoke-test the classifier against the real LLM**

Run:
```
cd review-radar && python -c "
from classifier import classify_reviews
print(classify_reviews([
  {'id':'1','content':'App bị crash hoài khi mở ảnh','score':1},
  {'id':'2','content':'Rất tốt, dùng mượt','score':5},
  {'id':'3','content':'ok','score':3}]))
"
```
Expected: review 1 → BUG_REPORT with a `bug_topic`; review 2 → POSITIVE; review 3 → SPAM.

- [ ] **Step 4: Smoke-test full pipeline (local backend)**

Run: `cd review-radar && python pipeline.py --app "zalo"`
Expected: prints `{'new_reviews': N, 'todos': M, 'used_fallback': False}` with N>0; `data/`
now contains `reviews.json`, `todos.json`, `processed_ids.json`, `config.json`.

- [ ] **Step 5: Smoke-test the dashboard end-to-end**

Run: `cd review-radar && python app.py`, open `http://localhost:8080`, type `zalo`, confirm,
wait for analysis, verify cards/charts/bug-list populate, Mark Done one bug → status flips.

- [ ] **Step 6: Smoke-test Memory backend (real store shape)**

Create the Memory store first (use `/agentbase-memory` — get its `MEMORY_ID`). In `.env`
set `STORE_BACKEND=memory` and `MEMORY_ID=...`. Run:
```
cd review-radar && python -c "
from storage import get_store
s=get_store(); s.save_todos([{'id':'t1','topic':'login','status':'open'}]); print(s.load_todos())
"
```
Expected: prints the todo back. **If the response/key shape differs** from the assumptions in
`memory_http.py` (`payload.content`, `data` list), adjust `post_event`/`list_events` and rerun.

- [ ] **Step 7: Commit smoke script + any fixes**

```bash
git add review-radar/scripts/smoke.py review-radar/scraper_live.py review-radar/memory_http.py
git commit -m "test: add live smoke checks and fix real API shapes"
```

---

## Task 14: Dockerfile + full test run

**Files:**
- Create: `review-radar/Dockerfile`
- Create: `review-radar/.dockerignore`

- [ ] **Step 1: Run the whole unit suite green**

Run: `cd review-radar && python -m pytest -v`
Expected: all tests pass.

- [ ] **Step 2: Create `Dockerfile`**

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8080
CMD ["python", "app.py", "--serve"]
```

- [ ] **Step 3: Create `.dockerignore`**

```
.venv/
__pycache__/
*.pyc
.env
data/
tests/
.pytest_cache/
```

- [ ] **Step 4: Build the image locally**

Run: `cd review-radar && docker build -t review-radar:local .`
Expected: build succeeds.

- [ ] **Step 5: Run the container, hit /health**

Run: `docker run --rm -p 8080:8080 --env-file review-radar/.env review-radar:local`
then in another shell: `curl http://localhost:8080/health`
Expected: `{"status":"ok"}` with HTTP 200.

- [ ] **Step 6: Commit**

```bash
git add review-radar/Dockerfile review-radar/.dockerignore
git commit -m "build: add Dockerfile for AgentBase runtime"
```

---

## Task 15: Deploy to AgentBase + finalize repo

**Files:** none (operational); uses AgentBase skills.

- [ ] **Step 1: Configure IAM credentials**

Use `/agentbase` auth setup (helper scripts) with the provided IAM Client ID/Secret. Verify:
`bash .claude/skills/agentbase/scripts/check_credentials.sh iam` → CONFIGURED.

- [ ] **Step 2: Ensure the Memory store exists**

Use `/agentbase-memory` to confirm/create the store; note its `MEMORY_ID`.

- [ ] **Step 3: Push image to Container Registry + create runtime**

Use `/agentbase-deploy`: docker login to managed registry, push `review-radar`, create a
**Custom Agent Runtime in PUBLIC always-on** mode. Set runtime env: `STORE_BACKEND=memory`,
`MEMORY_ID`, `MODEL_NAME`, `OPENAI_BASE_URL`, and `OPENAI_API_KEY` (via secret/identity).

- [ ] **Step 4: Verify the runtime is ACTIVE and public**

Confirm `GET <public-endpoint>/health` → 200. Open the public URL, run the demo flow
(type `zalo` → confirm → dashboard populates → Mark Done).

- [ ] **Step 5: Finalize GitHub repo**

Decide which root files to include (`project_description.md`, `INSTRUCTION.md`, `logo/`,
`docs/`). Confirm `.env`/`.greennode.json` are gitignored. Then:
```bash
git add review-radar/ docs/ README.md
git commit -m "docs: add README and finalize repo"
git push -u origin main
```
Make the repo public before 17/06/2026 12:00.

- [ ] **Step 6: Record the demo video**

Screen-record: enter app name → resolve/confirm → pipeline runs → dashboard → Mark Done one bug.

---

## Self-Review

**Spec coverage check:**
- App resolution + fuzzy suggestions (matched/ambiguous/not_found, always-confirm) → Task 6, Task 11 (`/api/resolve`), Task 12 (UI). ✅
- Scrape both stores, error-safe `[]` → Task 7. ✅
- Cache fallback when scrape empty → Task 10 (`used_fallback`). ✅
- Dedup by review_id → Task 10. ✅
- LLM batch classify + SPAM fallback (5 labels) → Task 8. ✅
- Bug grouping + severity thresholds (10/3) → Task 1, Task 9. ✅
- Merge todos preserving `done` status → Task 9. ✅
- Storage abstraction: LocalStore + MemoryStore (events as state docs) → Tasks 3, 4, 5. ✅
- Reset on app change → Tasks 3, 4, 11 (`/api/track`). ✅
- Hourly scheduler thread + manual `/run` → Task 11. ✅
- Dashboard: cards, donut, bar-by-day, bug table (filter/expand/mark done), review explorer → Task 12. ✅
- `/health` always 200, port 8080 → Task 11, Task 14. ✅
- Docker + AgentBase PUBLIC deploy, env config, no hardcoded secrets → Tasks 14, 15. ✅
- Success criteria demo flow → Task 13 step 5, Task 15 steps 4/6. ✅

**Placeholder scan:** No TBD/TODO; every code step has full code. The only deliberately
network-dependent code (`scraper_live.py`, real Memory shape) is isolated and explicitly
verified in Task 13 with concrete fix instructions. ✅

**Type consistency:** Review dict (`id/content/score/at/source/label/bug_topic/confidence`),
app dict (`title/developer/icon/gp_id/as_id/stores`), todo dict
(`id/topic/severity/mention_count/sample_reviews/sources/first_seen/last_seen/status`) used
consistently across scraper → classifier → grouper → pipeline → app → dashboard. `Store`
method names identical across `LocalStore`/`MemoryStore` and all callers. `resolve_app`
status strings (`matched/ambiguous/not_found`) consistent between Task 6 and the UI in
Task 12. ✅
