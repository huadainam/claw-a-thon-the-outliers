from storage import LocalStore, LocalRegistry
from app import create_app
from datetime import datetime, timezone, timedelta

def make_client(tmp_path, **overrides):
    registry = LocalRegistry(data_dir=str(tmp_path))
    stores = {}
    def factory(app_id):
        if app_id not in stores:
            stores[app_id] = LocalStore(data_dir=str(tmp_path), app_id=app_id)
        return stores[app_id]
    app = create_app(registry=registry, store_factory=factory, **overrides)
    app.config["TESTING"] = True
    return app.test_client(), registry, factory

def test_health_always_200(tmp_path):
    client, _, _ = make_client(tmp_path)
    assert client.get("/health").status_code == 200

def test_resolve_endpoint(tmp_path):
    def fake_resolve(name):
        return {"status": "matched", "app": {"title": "Zalo", "gp_id": "g", "as_id": "a"}}
    client, _, _ = make_client(tmp_path, resolve_fn=fake_resolve)
    body = client.post("/api/resolve", json={"name": "zalo"}).get_json()
    assert body["status"] == "matched"
    assert body["app"]["title"] == "Zalo"

def test_track_registers_app_sets_active_and_runs(tmp_path):
    calls = {"ran": 0}
    def fake_run(store):
        calls["ran"] += 1
    client, registry, factory = make_client(tmp_path, run_fn=fake_run)
    resp = client.post("/api/track", json={"title": "Zalo", "gp_id": "com.zing.zalo", "as_id": "a"})
    body = resp.get_json()
    assert resp.status_code == 200
    assert body["app_id"] == "com.zing.zalo"
    assert registry.get_active() == "com.zing.zalo"
    assert factory("com.zing.zalo").load_config()["title"] == "Zalo"
    assert calls["ran"] == 1

def test_track_allows_10k_review_backfill_limit(tmp_path):
    client, _, factory = make_client(tmp_path, run_fn=lambda s: None)
    client.post("/api/track", json={
        "title": "ZaloPay",
        "as_id": "1112407590",
        "review_limit": 10000,
    })
    assert factory("1112407590").load_config()["review_limit"] == 10000

def test_track_clamps_review_backfill_limit(tmp_path):
    client, _, factory = make_client(tmp_path, run_fn=lambda s: None)
    client.post("/api/track", json={
        "title": "ZaloPay",
        "as_id": "1112407590",
        "review_limit": 50000,
    })
    assert factory("1112407590").load_config()["review_limit"] == 10000

def test_apps_lists_tracked(tmp_path):
    client, registry, _ = make_client(tmp_path, run_fn=lambda s: None)
    client.post("/api/track", json={"title": "Zalo", "gp_id": "com.zing.zalo"})
    client.post("/api/track", json={"title": "ZaloPay", "as_id": "1112407590"})
    body = client.get("/api/apps").get_json()
    assert body["active_app_id"] == "1112407590"
    assert {a["title"] for a in body["apps"]} == {"Zalo", "ZaloPay"}

def test_apps_includes_review_totals(tmp_path):
    client, registry, factory = make_client(tmp_path, run_fn=lambda s: None)
    client.post("/api/track", json={"title": "Zalo", "gp_id": "com.zing.zalo"})
    factory("com.zing.zalo").append_reviews([{"id": "1"}, {"id": "2"}])
    body = client.get("/api/apps").get_json()
    assert body["apps"][0]["total_reviews"] == 2

def test_apps_sorted_zalopay_first_then_alphabetical(tmp_path):
    client, registry, _ = make_client(tmp_path, run_fn=lambda s: None)
    client.post("/api/track", json={"title": "Zing MP3", "gp_id": "vng.zing.mp3"})
    client.post("/api/track", json={"title": "Crossfire: Legends", "as_id": "6748588650"})
    client.post("/api/track", json={"title": "Zalopay-Thanh toán & Tài chính", "as_id": "1112407590"})
    client.post("/api/track", json={"title": "Ballistic Hero VNG", "as_id": "6754264117"})
    titles = [a["title"] for a in client.get("/api/apps").get_json()["apps"]]
    assert titles == [
        "Zalopay-Thanh toán & Tài chính",
        "Ballistic Hero VNG",
        "Crossfire: Legends",
        "Zing MP3",
    ]

def test_set_active_switches_app(tmp_path):
    client, registry, _ = make_client(tmp_path, run_fn=lambda s: None)
    client.post("/api/track", json={"title": "Zalo", "gp_id": "com.zing.zalo"})
    client.post("/api/track", json={"title": "ZaloPay", "as_id": "1112407590"})
    client.post("/api/active", json={"app_id": "com.zing.zalo"})
    assert registry.get_active() == "com.zing.zalo"

def test_patch_todo_status(tmp_path):
    client, registry, factory = make_client(tmp_path, run_fn=lambda s: None)
    client.post("/api/track", json={"title": "Zalo", "gp_id": "com.zing.zalo"})
    factory("com.zing.zalo").save_todos([{"id": "t1", "topic": "login", "status": "open"}])
    resp = client.patch("/api/todos/t1", json={"status": "done"})
    assert resp.status_code == 200
    assert factory("com.zing.zalo").load_todos()[0]["status"] == "done"

def test_patch_todo_status_uses_explicit_app_id(tmp_path):
    client, registry, factory = make_client(tmp_path, run_fn=lambda s: None)
    client.post("/api/track", json={"title": "Zalo", "gp_id": "com.zing.zalo"})
    client.post("/api/track", json={"title": "ZaloPay", "as_id": "1112407590"})
    factory("com.zing.zalo").save_todos([{"id": "t1", "topic": "login", "status": "open"}])
    factory("1112407590").save_todos([{"id": "t1", "topic": "payment", "status": "open"}])

    resp = client.patch("/api/todos/t1?app_id=com.zing.zalo", json={"status": "done"})

    assert resp.status_code == 200
    assert resp.get_json()["ok"] is True
    assert factory("com.zing.zalo").load_todos()[0]["status"] == "done"
    assert factory("1112407590").load_todos()[0]["status"] == "open"

def test_stats_shape_with_meta(tmp_path):
    client, registry, factory = make_client(tmp_path, run_fn=lambda s: None)
    client.post("/api/track", json={"title": "Zalo", "gp_id": "com.zing.zalo"})
    factory("com.zing.zalo").append_reviews([
        {"id": "1", "label": "BUG_REPORT", "at": "2026-06-10T00:00:00"},
        {"id": "2", "label": "POSITIVE", "at": "2026-06-10T00:00:00"},
    ])
    body = client.get("/api/stats").get_json()
    assert body["app"]["title"] == "Zalo"
    assert body["total"] == 2
    assert body["by_label"]["BUG_REPORT"] == 1
    assert "status" in body["meta"]

def test_stats_empty_when_no_active_app(tmp_path):
    client, _, _ = make_client(tmp_path)
    body = client.get("/api/stats").get_json()
    assert body["app"] == {}
    assert body["total"] == 0
    assert body["meta"]["status"] == "idle"

def test_apps_recovers_stale_analyzing_meta(tmp_path):
    client, registry, factory = make_client(tmp_path, run_fn=lambda s: None)
    client.post("/api/track", json={"title": "Momo", "as_id": "918751511"})
    old = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    factory("918751511").save_meta({
        "status": "analyzing",
        "progress": {"done": 330, "total": 500},
        "last_updated": old,
    })

    body = client.get("/api/apps").get_json()
    app = body["apps"][0]

    assert app["status"] == "idle"
    assert app["progress"] == {"done": 330, "total": 500}
    assert factory("918751511").load_meta()["status"] == "idle"

def test_stats_keeps_recent_analyzing_meta(tmp_path):
    client, registry, factory = make_client(tmp_path, run_fn=lambda s: None)
    client.post("/api/track", json={"title": "Momo", "as_id": "918751511"})
    factory("918751511").save_meta({
        "status": "analyzing",
        "progress": {"done": 30, "total": 500},
        "last_updated": datetime.now(timezone.utc).isoformat(),
    })

    body = client.get("/api/stats?app_id=918751511").get_json()

    assert body["meta"]["status"] == "analyzing"
    assert body["meta"]["progress"] == {"done": 30, "total": 500}
