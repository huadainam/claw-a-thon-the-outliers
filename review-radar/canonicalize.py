"""Cluster free-text bug topics into consistent canonical labels via the LLM.

The classifier emits a slightly different `bug_topic` per review, so grouping by
the raw string never aggregates mentions (everything stays severity "low"). This
maps each raw topic to a shared canonical label so similar bugs cluster and
severity rises to Medium/Critical.
"""
import json
import re

PROMPT_TEMPLATE = """Bạn là chuyên gia phân tích bug ứng dụng. Dưới đây là danh sách các chủ đề bug (tiếng Việt) trích từ review. Hãy gom các chủ đề CÙNG BẢN CHẤT về một nhãn chuẩn ngắn gọn, nhất quán (vd: "Lỗi đăng nhập", "Crash/đơ app", "Lỗi thanh toán", "Lỗi nạp tiền", "Lỗi thông báo", "Lag/giật", "Mất tài khoản/dữ liệu", "Lỗi cập nhật").
{preferred_block}Danh sách chủ đề gốc:
{topics_json}

Trả về DUY NHẤT một JSON object ánh xạ mỗi chủ đề gốc -> nhãn chuẩn:
{{"<chủ đề gốc>": "<nhãn chuẩn>"}}"""

def _parse_obj(raw: str) -> dict:
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1:
        text = text[start:end + 1]
    return json.loads(text)

def canonicalize_topics(topics, preferred=None, llm=None) -> dict:
    """Map each raw topic -> canonical label. Falls back to identity on any error.
    `preferred` is a list of existing canonical labels to reuse for stability."""
    topics = sorted({t for t in topics if t})
    if not topics:
        return {}
    if llm is None:
        from classifier import _llm_default
        llm = _llm_default
    pref_block = ""
    if preferred:
        pref_block = ("Ưu tiên DÙNG LẠI các nhãn chuẩn đã có sau nếu phù hợp: "
                      + json.dumps(sorted(set(preferred)), ensure_ascii=False) + "\n")
    prompt = PROMPT_TEMPLATE.format(preferred_block=pref_block,
                                    topics_json=json.dumps(topics, ensure_ascii=False))
    try:
        mapping = _parse_obj(llm(prompt))
    except Exception:
        return {t: t for t in topics}
    return {t: (mapping.get(t) or t) for t in topics}
