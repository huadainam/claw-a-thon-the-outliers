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

def test_memory_store_reviews_are_chunked():
    s = make_store()
    s.REVIEWS_CHUNK_SIZE = 2
    s.append_reviews([{"id": "a"}, {"id": "b"}, {"id": "c"}])

    assert s.load_reviews() == [{"id": "a"}, {"id": "b"}, {"id": "c"}]
    assert s.review_count() == 3
    assert "rr-reviews-index" in s.http.sessions
    chunk_sessions = [name for name in s.http.sessions if name.startswith("rr-reviews-chunk-")]
    assert len(chunk_sessions) == 2

def test_memory_store_todos_are_chunked():
    s = make_store()
    s.TODOS_CHUNK_SIZE = 2
    todos = [
        {"id": "t1", "topic": "A", "status": "open"},
        {"id": "t2", "topic": "B", "status": "open"},
        {"id": "t3", "topic": "C", "status": "open"},
    ]

    s.save_todos(todos)

    assert s.load_todos() == todos
    assert "rr-todos-index" in s.http.sessions
    chunk_sessions = [name for name in s.http.sessions if name.startswith("rr-todos-chunk-")]
    assert len(chunk_sessions) == 2

def test_memory_store_reads_legacy_todos_without_index():
    s = make_store()
    s.http.post_event("m1", "agent", "rr-todos", '[{"id":"legacy"}]')

    assert s.load_todos() == [{"id": "legacy"}]

def test_memory_store_review_count_reads_index_without_chunks():
    s = make_store()
    s.REVIEWS_CHUNK_SIZE = 2
    s.append_reviews([{"id": "a"}, {"id": "b"}, {"id": "c"}])
    for name in list(s.http.sessions):
        if name.startswith("rr-reviews-chunk-"):
            del s.http.sessions[name]

    assert s.review_count() == 3

def test_memory_store_reads_legacy_reviews_without_index():
    s = make_store()
    s.http.post_event("m1", "agent", "rr-reviews", '[{"id":"legacy"}]')

    assert s.load_reviews() == [{"id": "legacy"}]
    assert s.review_count() == 1

def test_memory_store_reset_clears():
    s = make_store()
    s.save_processed_ids({"a"})
    s.append_reviews([{"id": "a"}])
    s.save_todos([{"id": "t1"}])
    s.reset()
    assert s.load_processed_ids() == set()
    assert s.load_reviews() == []
    assert s.load_todos() == []
