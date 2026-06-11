from storage import (LocalStore, LocalRegistry, MemoryRegistry, app_key,
                     DEFAULT_META)

def test_local_store_partitions_by_app(tmp_path):
    a = LocalStore(data_dir=str(tmp_path), app_id="com.zing.zalo")
    b = LocalStore(data_dir=str(tmp_path), app_id="1112407590")
    a.append_reviews([{"id": "1"}])
    b.append_reviews([{"id": "2"}, {"id": "3"}])
    assert len(a.load_reviews()) == 1
    assert len(b.load_reviews()) == 2  # isolated from a

def test_meta_roundtrip_default(tmp_path):
    s = LocalStore(data_dir=str(tmp_path), app_id="x")
    assert s.load_meta()["status"] == "idle"
    s.save_meta({"status": "analyzing", "progress": {"done": 5, "total": 10},
                 "last_updated": "2026-06-11T00:00:00"})
    assert s.load_meta()["status"] == "analyzing"
    assert s.load_meta()["progress"]["done"] == 5

def test_app_key_prefers_gp_then_as():
    assert app_key({"gp_id": "com.x", "as_id": "9"}) == "com.x"
    assert app_key({"gp_id": None, "as_id": "9"}) == "9"

def test_local_registry_upsert_and_active(tmp_path):
    reg = LocalRegistry(data_dir=str(tmp_path))
    assert reg.list_apps() == []
    assert reg.get_active() is None
    key = reg.upsert_app({"title": "Zalo", "gp_id": "com.zing.zalo", "as_id": "579523206"})
    assert key == "com.zing.zalo"
    assert reg.get_active() == "com.zing.zalo"
    assert len(reg.list_apps()) == 1
    assert reg.get_app("com.zing.zalo")["title"] == "Zalo"
    # upsert same app again does not duplicate
    reg.upsert_app({"title": "Zalo", "gp_id": "com.zing.zalo"})
    assert len(reg.list_apps()) == 1
    # a second app, then switch active
    reg.upsert_app({"title": "ZaloPay", "as_id": "1112407590"})
    assert reg.get_active() == "1112407590"
    assert len(reg.list_apps()) == 2
    reg.set_active("com.zing.zalo")
    assert reg.get_active() == "com.zing.zalo"

class FakeHTTP:
    def __init__(self):
        self.sessions = {}
    def post_event(self, memory_id, actor_id, session_id, content):
        self.sessions.setdefault(session_id, []).append({"content": content})
    def list_events(self, memory_id, actor_id, session_id):
        return list(self.sessions.get(session_id, []))

def test_memory_registry_roundtrip():
    reg = MemoryRegistry(memory_id="m1", http=FakeHTTP())
    reg.upsert_app({"title": "Zalo", "gp_id": "com.zing.zalo"})
    assert reg.get_active() == "com.zing.zalo"
    assert reg.list_apps()[0]["title"] == "Zalo"
