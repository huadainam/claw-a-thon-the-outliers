from seed import pick_app, seed
from storage import LocalRegistry, LocalStore

def test_pick_app_matched():
    assert pick_app({"status": "matched", "app": {"title": "Zalo"}})["title"] == "Zalo"

def test_pick_app_ambiguous_takes_first():
    res = {"status": "ambiguous", "suggestions": [{"title": "A"}, {"title": "B"}]}
    assert pick_app(res)["title"] == "A"

def test_pick_app_not_found_returns_none():
    assert pick_app({"status": "not_found"}) is None

def test_seed_writes_apps_and_skips_unresolved(tmp_path):
    def fake_resolve(name):
        if name == "ghost":
            return {"status": "not_found"}
        return {"status": "matched",
                "app": {"title": name.title(), "gp_id": f"com.{name}", "as_id": None}}

    def fake_runner(store):
        store.append_reviews([{"id": "1", "label": "BUG_REPORT", "bug_topic": "X",
                               "content": "lỗi", "source": "google_play", "at": "d"}])

    report = seed(["zalo", "ghost", "momo"], seed_dir=str(tmp_path),
                  resolve_fn=fake_resolve, runner=fake_runner)

    assert len(report["seeded"]) == 2
    assert len(report["skipped"]) == 1
    reg = LocalRegistry(data_dir=str(tmp_path))
    assert {a["title"] for a in reg.list_apps()} == {"Zalo", "Momo"}
    assert reg.get_active() is None  # gallery mode
    assert len(LocalStore(data_dir=str(tmp_path), app_id="com.zalo").load_reviews()) == 1
