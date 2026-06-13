from storage import LocalStore
from pipeline import run_pipeline

def make_deps(gp_reviews, as_reviews):
    return dict(
        scrape_gp=lambda app_id: list(gp_reviews),
        scrape_as=lambda app_id: list(as_reviews),
        classify=lambda revs: [dict(r, label="BUG_REPORT", bug_topic="Lỗi A",
                                    confidence=0.9) for r in revs],
        canonicalize_fn=lambda topics, preferred: {t: t for t in topics},
    )

def test_pipeline_sets_meta_status_and_progress(tmp_path):
    store = LocalStore(data_dir=str(tmp_path))
    store.save_config({"title": "Zalo", "gp_id": "g", "as_id": "a"})
    gp = [{"id": f"g{i}", "content": "lỗi", "score": 1, "source": "google_play",
           "at": "2026-06-01"} for i in range(5)]
    run_pipeline(store=store, batch_size=2, **make_deps(gp, []))
    m = store.load_meta()
    assert m["status"] == "idle"
    assert m["progress"]["total"] == 5
    assert m["progress"]["done"] == 5
    assert m["last_updated"]

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

def test_pipeline_skips_regroup_when_refresh_has_no_new_reviews(tmp_path):
    store = LocalStore(data_dir=str(tmp_path))
    store.save_config({"title": "Zalo", "gp_id": "g", "as_id": "a"})
    store.save_processed_ids({"g1"})
    store.save_todos([{"id": "t1", "topic": "Lỗi A", "status": "open"}])
    gp = [{"id": "g1", "content": "lỗi", "score": 1, "source": "google_play", "at": "d"}]
    calls = {"canonicalize": 0}

    def canonicalize(topics, preferred):
        calls["canonicalize"] += 1
        return {t: t for t in topics}

    deps = make_deps(gp, [])
    deps["canonicalize_fn"] = canonicalize
    result = run_pipeline(store=store, **deps)
    assert result == {"new_reviews": 0, "todos": 1, "used_fallback": False}
    assert calls["canonicalize"] == 0
    assert store.load_meta()["status"] == "idle"

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
