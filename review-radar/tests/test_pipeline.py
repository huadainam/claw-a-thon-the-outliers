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
