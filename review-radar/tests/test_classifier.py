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
