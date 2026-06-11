from storage import LocalRegistry, LocalStore
from seed import seed
from bootstrap import bootstrap_from_seed

def _build_seed(seed_dir):
    def fake_resolve(name):
        return {"status": "matched",
                "app": {"title": name.title(), "gp_id": f"com.{name}", "as_id": None}}
    def fake_runner(store):
        store.append_reviews([{"id": "1", "label": "BUG_REPORT", "bug_topic": "X",
                               "content": "lỗi", "source": "google_play", "at": "d"}])
        store.save_todos([{"id": "t1", "topic": "X", "status": "open",
                           "severity": "low", "mention_count": 1}])
    seed(["zalo", "momo"], seed_dir=seed_dir, resolve_fn=fake_resolve, runner=fake_runner)

def test_bootstrap_loads_seed_when_empty(tmp_path):
    seed_dir = str(tmp_path / "seed")
    live_dir = str(tmp_path / "live")
    _build_seed(seed_dir)

    reg = LocalRegistry(data_dir=live_dir)
    factory = lambda app_id: LocalStore(data_dir=live_dir, app_id=app_id)

    n = bootstrap_from_seed(reg, factory, seed_dir=seed_dir)
    assert n == 2
    assert {a["title"] for a in reg.list_apps()} == {"Zalo", "Momo"}
    assert reg.get_active() is None
    assert len(factory("com.zalo").load_reviews()) == 1
    assert factory("com.zalo").load_todos()[0]["topic"] == "X"

def test_bootstrap_is_noop_when_already_populated(tmp_path):
    seed_dir = str(tmp_path / "seed")
    live_dir = str(tmp_path / "live")
    _build_seed(seed_dir)
    reg = LocalRegistry(data_dir=live_dir)
    factory = lambda app_id: LocalStore(data_dir=live_dir, app_id=app_id)
    bootstrap_from_seed(reg, factory, seed_dir=seed_dir)

    # user marks a bug done; a second bootstrap must NOT overwrite it
    factory("com.zalo").save_todos([{"id": "t1", "topic": "X", "status": "done"}])
    n = bootstrap_from_seed(reg, factory, seed_dir=seed_dir)
    assert n == 0
    assert factory("com.zalo").load_todos()[0]["status"] == "done"

def test_bootstrap_noop_without_seed_dir(tmp_path):
    reg = LocalRegistry(data_dir=str(tmp_path / "live"))
    factory = lambda app_id: LocalStore(data_dir=str(tmp_path / "live"), app_id=app_id)
    assert bootstrap_from_seed(reg, factory, seed_dir=str(tmp_path / "nope")) == 0
