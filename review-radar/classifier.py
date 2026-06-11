import json
import re

BATCH_SIZE = 30

PROMPT_TEMPLATE = """Bạn là chuyên gia phân tích review ứng dụng mobile. Phân loại từng review dưới đây.

Các loại phân loại:
- BUG_REPORT: user báo lỗi, crash, tính năng không hoạt động
- FEATURE_REQUEST: user đề xuất tính năng mới
- COMPLAINT: phàn nàn về UX, tốc độ, thiết kế nhưng không phải bug cụ thể
- POSITIVE: review tích cực, khen ngợi
- SPAM: review rác, quá ngắn (<5 từ), chỉ emoji, vô nghĩa

Trả về DUY NHẤT một JSON array, đúng thứ tự input, mỗi item:
{{"id": "<review_id>", "label": "<BUG_REPORT|FEATURE_REQUEST|COMPLAINT|POSITIVE|SPAM>", "bug_topic": "<chủ đề bug ngắn bằng tiếng Việt nếu BUG_REPORT, còn lại null>", "confidence": <0.0-1.0>}}

Reviews:
{reviews_json}
"""

def _parse_batch_response(raw: str):
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    start, end = text.find("["), text.rfind("]")
    if start != -1 and end != -1:
        text = text[start:end + 1]
    return json.loads(text)

def _llm_default(prompt: str) -> str:
    from openai import OpenAI
    from config import get_config
    cfg = get_config()
    client = OpenAI(api_key=cfg.openai_api_key, base_url=cfg.openai_base_url)
    resp = client.chat.completions.create(
        model=cfg.model_name,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    return resp.choices[0].message.content

def classify_reviews(reviews: list, llm=None) -> list:
    llm = llm or _llm_default
    out = []
    for i in range(0, len(reviews), BATCH_SIZE):
        batch = reviews[i:i + BATCH_SIZE]
        payload = [{"id": r["id"], "content": r.get("content", ""),
                    "score": r.get("score", 0)} for r in batch]
        prompt = PROMPT_TEMPLATE.format(
            reviews_json=json.dumps(payload, ensure_ascii=False))
        try:
            parsed = _parse_batch_response(llm(prompt))
            by_id = {str(p["id"]): p for p in parsed}
        except Exception:
            by_id = {}
        for r in batch:
            p = by_id.get(str(r["id"]))
            merged = dict(r)
            if p and p.get("label"):
                merged["label"] = p["label"]
                merged["bug_topic"] = p.get("bug_topic")
                merged["confidence"] = p.get("confidence", 0.0)
            else:
                merged["label"] = "SPAM"
                merged["bug_topic"] = None
                merged["confidence"] = 0.0
            out.append(merged)
    return out
