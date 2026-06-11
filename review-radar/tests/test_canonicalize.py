import json
from canonicalize import canonicalize_topics, _parse_obj

def test_canonicalize_maps_to_labels():
    def fake_llm(prompt):
        return json.dumps({
            "không đăng nhập được": "Lỗi đăng nhập",
            "lỗi login google": "Lỗi đăng nhập",
            "app bị crash": "Crash/đơ app",
        })
    m = canonicalize_topics(
        ["không đăng nhập được", "lỗi login google", "app bị crash"], llm=fake_llm)
    assert m["không đăng nhập được"] == "Lỗi đăng nhập"
    assert m["lỗi login google"] == "Lỗi đăng nhập"
    assert m["app bị crash"] == "Crash/đơ app"

def test_canonicalize_empty():
    assert canonicalize_topics([], llm=lambda p: "{}") == {}

def test_canonicalize_parse_failure_is_identity():
    m = canonicalize_topics(["a", "b"], llm=lambda p: "not json")
    assert m == {"a": "a", "b": "b"}

def test_canonicalize_fills_missing_with_identity():
    # LLM omits one topic -> it maps to itself
    m = canonicalize_topics(["x", "y"], llm=lambda p: json.dumps({"x": "X"}))
    assert m["x"] == "X"
    assert m["y"] == "y"

def test_parse_obj_handles_code_fence():
    assert _parse_obj('```json\n{"a": "B"}\n```')["a"] == "B"
