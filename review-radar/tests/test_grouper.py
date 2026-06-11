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
