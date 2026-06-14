from storage import LocalStore, LocalRegistry
from app import create_app, _enqueue_scheduled_crawls, _queue_positions, REVIEW_DAY_TZ
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
    factory("com.zing.zalo").save_meta({
        "status": "idle",
        "progress": {"done": 2, "total": 2},
        "last_updated": "2026-06-14T00:00:00+00:00",
        "last_run": {
            "crawled_reviews": 5,
            "new_reviews": 2,
            "classified_reviews": 2,
            "total_reviews": 2,
            "used_fallback": False,
        },
    })
    body = client.get("/api/apps").get_json()
    assert body["apps"][0]["total_reviews"] == 2
    assert body["apps"][0]["last_run"]["crawled_reviews"] == 5
    assert body["apps"][0]["last_run"]["classified_reviews"] == 2
    assert body["apps"][0]["hourly_refresh_enabled"] is False

def test_apps_lite_does_not_load_review_blobs(tmp_path):
    client, registry, factory = make_client(tmp_path, run_fn=lambda s: None)
    client.post("/api/track", json={"title": "Zalo", "gp_id": "com.zing.zalo", "icon": "https://example.com/zalo.png"})
    store = factory("com.zing.zalo")

    def fail_load_reviews():
        raise AssertionError("lite app list should not load reviews")

    store.load_reviews = fail_load_reviews

    body = client.get("/api/apps?lite=1").get_json()

    assert body["apps"][0]["title"] == "Zalo"
    assert body["apps"][0]["icon"] == "https://example.com/zalo.png"
    assert body["apps"][0]["total_reviews"] == 0

def test_patch_app_toggles_hourly_refresh_and_persists_config(tmp_path):
    client, registry, factory = make_client(tmp_path, run_fn=lambda s: None)
    client.post("/api/track", json={"title": "Zalo", "gp_id": "com.zing.zalo"})

    resp = client.patch("/api/apps/com.zing.zalo", json={"hourly_refresh_enabled": False})

    assert resp.status_code == 200
    assert resp.get_json()["app"]["hourly_refresh_enabled"] is False
    assert registry.get_app("com.zing.zalo")["hourly_refresh_enabled"] is False
    assert factory("com.zing.zalo").load_config()["hourly_refresh_enabled"] is False
    assert client.get("/api/apps").get_json()["apps"][0]["hourly_refresh_enabled"] is False

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

def test_run_now_starts_active_app(tmp_path):
    calls = []
    def fake_run(store):
        calls.append(store.load_config().get("title"))

    client, registry, _ = make_client(tmp_path, run_fn=fake_run)
    client.post("/api/track", json={"title": "Zalo", "gp_id": "com.zing.zalo"})
    calls.clear()

    resp = client.post("/run")

    assert resp.status_code == 200
    assert resp.get_json()["ok"] is True
    assert calls == ["Zalo"]

def test_scheduled_crawl_enqueues_all_hourly_enabled_apps_not_only_active(tmp_path):
    client, registry, factory = make_client(tmp_path, run_fn=lambda s: None)
    client.post("/api/track", json={"title": "Zalo", "gp_id": "com.zing.zalo", "hourly_refresh_enabled": True})
    client.post("/api/track", json={"title": "ZaloPay", "as_id": "1112407590", "hourly_refresh_enabled": True})
    registry.set_active(None)
    calls = []

    count = _enqueue_scheduled_crawls(
        registry,
        factory,
        lambda store: calls.append(store.load_config().get("title")),
    )

    assert count == 2
    assert calls == ["Zalo", "ZaloPay"]

def test_scheduled_crawl_skips_apps_before_refresh_interval(tmp_path):
    client, registry, factory = make_client(tmp_path, run_fn=lambda s: None)
    client.post("/api/track", json={"title": "Zalo", "gp_id": "com.zing.zalo", "hourly_refresh_enabled": True})
    now = datetime(2026, 6, 14, 8, 0, tzinfo=timezone.utc)
    factory("com.zing.zalo").save_meta({
        "status": "idle",
        "progress": {"done": 0, "total": 0},
        "last_updated": (now - timedelta(minutes=30)).isoformat(),
    })
    calls = []

    count = _enqueue_scheduled_crawls(
        registry,
        factory,
        lambda store: calls.append(store.load_config().get("title")),
        now=now,
        interval=timedelta(hours=1),
    )

    assert count == 0
    assert calls == []

def test_scheduled_crawl_enqueues_due_apps_and_marks_schedule_time(tmp_path):
    client, registry, factory = make_client(tmp_path, run_fn=lambda s: None)
    client.post("/api/track", json={"title": "Zalo", "gp_id": "com.zing.zalo", "hourly_refresh_enabled": True})
    now = datetime(2026, 6, 14, 8, 0, tzinfo=timezone.utc)
    factory("com.zing.zalo").save_meta({
        "status": "idle",
        "progress": {"done": 0, "total": 0},
        "last_updated": (now - timedelta(hours=2)).isoformat(),
    })
    calls = []

    count = _enqueue_scheduled_crawls(
        registry,
        factory,
        lambda store: calls.append(store.load_config().get("title")),
        now=now,
        interval=timedelta(hours=1),
    )

    assert count == 1
    assert calls == ["Zalo"]
    assert factory("com.zing.zalo").load_meta()["last_scheduled_refresh_at"] == now.isoformat()

def test_scheduled_crawl_skips_apps_with_hourly_refresh_disabled(tmp_path):
    client, registry, factory = make_client(tmp_path, run_fn=lambda s: None)
    client.post("/api/track", json={"title": "Zalo", "gp_id": "com.zing.zalo", "hourly_refresh_enabled": True})
    client.post("/api/track", json={"title": "ZaloPay", "as_id": "1112407590", "hourly_refresh_enabled": True})
    registry.update_app("com.zing.zalo", {"hourly_refresh_enabled": False})
    calls = []

    count = _enqueue_scheduled_crawls(
        registry,
        factory,
        lambda store: calls.append(store.load_config().get("title")),
    )

    assert count == 1
    assert calls == ["ZaloPay"]

def test_scheduled_crawl_skips_apps_without_explicit_hourly_refresh(tmp_path):
    client, registry, factory = make_client(tmp_path, run_fn=lambda s: None)
    client.post("/api/track", json={"title": "Zalo", "gp_id": "com.zing.zalo"})
    calls = []

    count = _enqueue_scheduled_crawls(
        registry,
        factory,
        lambda store: calls.append(store.load_config().get("title")),
    )

    assert count == 0
    assert calls == []

def test_queue_positions_are_one_indexed_by_waiting_order():
    assert _queue_positions(["app-a", "app-b", "app-c"]) == {
        "app-a": 1,
        "app-b": 2,
        "app-c": 3,
    }

def test_patch_todo_status(tmp_path):
    client, registry, factory = make_client(tmp_path, run_fn=lambda s: None)
    client.post("/api/track", json={"title": "Zalo", "gp_id": "com.zing.zalo"})
    factory("com.zing.zalo").save_todos([{"id": "t1", "topic": "login", "status": "open"}])
    resp = client.patch("/api/todos/t1", json={"status": "done"})
    assert resp.status_code == 200
    assert factory("com.zing.zalo").load_todos()[0]["status"] == "done"

def test_patch_todo_supports_editable_workflow_statuses(tmp_path):
    client, registry, factory = make_client(tmp_path, run_fn=lambda s: None)
    client.post("/api/track", json={"title": "Zalo", "gp_id": "com.zing.zalo"})
    factory("com.zing.zalo").save_todos([{"id": "t1", "topic": "login", "status": "open"}])

    client.patch("/api/todos/t1", json={"status": "in_progress"})
    assert factory("com.zing.zalo").load_todos()[0]["status"] == "in_progress"

    client.patch("/api/todos/t1", json={"status": "ignored"})
    assert factory("com.zing.zalo").load_todos()[0]["status"] == "ignored"

    client.patch("/api/todos/t1", json={"status": "open"})
    assert factory("com.zing.zalo").load_todos()[0]["status"] == "open"

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
    cutoff_day = datetime.now(REVIEW_DAY_TZ).date() - timedelta(days=1)
    older_day = cutoff_day - timedelta(days=3)
    shifted_source_day = cutoff_day - timedelta(days=1)
    factory("com.zing.zalo").append_reviews([
        {"id": "1", "label": "BUG_REPORT", "at": f"{older_day.isoformat()}T00:00:00"},
        {"id": "2", "label": "POSITIVE", "at": f"{older_day.isoformat()}T00:00:00"},
        {"id": "3", "label": "BUG_REPORT", "at": f"{shifted_source_day.isoformat()}T18:30:00-07:00"},
    ])
    body = client.get("/api/stats").get_json()
    assert body["app"]["title"] == "Zalo"
    assert body["total"] == 3
    assert body["by_label"]["BUG_REPORT"] == 2
    assert body["source_cutoff_day"] == cutoff_day.isoformat()
    assert body["bug_by_day"][cutoff_day.isoformat()] == 1
    assert "status" in body["meta"]

def test_source_window_excludes_current_day_reviews(tmp_path):
    client, registry, factory = make_client(tmp_path, run_fn=lambda s: None)
    client.post("/api/track", json={"title": "Zalo", "gp_id": "com.zing.zalo"})
    today = datetime.now(REVIEW_DAY_TZ).date()
    cutoff_day = today - timedelta(days=1)
    future_day = today + timedelta(days=1)
    factory("com.zing.zalo").append_reviews([
        {"id": "yesterday", "label": "BUG_REPORT", "at": f"{cutoff_day.isoformat()}T23:59:00+07:00"},
        {"id": "today", "label": "POSITIVE", "at": f"{today.isoformat()}T00:00:00+07:00"},
        {"id": "future", "label": "COMPLAINT", "at": f"{future_day.isoformat()}T00:00:00+07:00"},
    ])

    reviews = client.get("/api/reviews").get_json()
    stats = client.get("/api/stats").get_json()
    apps = client.get("/api/apps").get_json()

    assert [r["id"] for r in reviews] == ["yesterday"]
    assert stats["total"] == 1
    assert stats["by_label"] == {"BUG_REPORT": 1}
    assert stats["source_cutoff_day"] == cutoff_day.isoformat()
    assert apps["apps"][0]["total_reviews"] == 1
    assert apps["apps"][0]["source_cutoff_day"] == cutoff_day.isoformat()

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

def test_apps_recovers_orphan_queued_meta(tmp_path):
    client, registry, factory = make_client(tmp_path, run_fn=lambda s: None)
    client.post("/api/track", json={"title": "Momo", "as_id": "918751511"})
    factory("918751511").save_meta({
        "status": "queued",
        "progress": {"done": 0, "total": 0},
        "last_updated": datetime.now(timezone.utc).isoformat(),
    })

    body = client.get("/api/apps").get_json()
    app = body["apps"][0]

    assert app["status"] == "idle"
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
