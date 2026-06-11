import uuid
from datetime import datetime, timezone
from models import severity_for_mentions

def _now_iso():
    return datetime.now(timezone.utc).isoformat()

def group_bugs(reviews, id_gen=None, now=None, topic_map=None):
    id_gen = id_gen or (lambda: str(uuid.uuid4()))
    now = now or _now_iso()
    topic_map = topic_map or {}
    buckets = {}  # topic.lower() -> group
    for r in reviews:
        if r.get("label") != "BUG_REPORT":
            continue
        raw = (r.get("bug_topic") or "Khác").strip()
        topic = (topic_map.get(raw) or raw).strip()  # canonical label when provided
        key = topic.lower()
        g = buckets.get(key)
        if g is None:
            g = {
                "id": id_gen(), "topic": topic, "severity": "low",
                "mention_count": 0, "sample_reviews": [], "sources": [],
                "first_seen": r.get("at") or now, "last_seen": r.get("at") or now,
                "status": "open",
            }
            buckets[key] = g
        g["mention_count"] += 1
        if len(g["sample_reviews"]) < 3 and r.get("content"):
            g["sample_reviews"].append(r["content"])
        src = r.get("source")
        if src and src not in g["sources"]:
            g["sources"].append(src)
        at = r.get("at")
        if at:
            g["last_seen"] = max(g["last_seen"], at)
            g["first_seen"] = min(g["first_seen"], at)
    for g in buckets.values():
        g["severity"] = severity_for_mentions(g["mention_count"])
    return list(buckets.values())

def merge_with_existing_todos(new_groups, existing_todos):
    by_topic = {t["topic"].lower(): t for t in existing_todos}
    for ng in new_groups:
        key = ng["topic"].lower()
        old = by_topic.get(key)
        if old:
            old["mention_count"] = ng["mention_count"]
            old["last_seen"] = ng["last_seen"]
            old["sample_reviews"] = ng["sample_reviews"]
            old["sources"] = ng["sources"]
            old["severity"] = ng["severity"]
            # status preserved, id preserved
        else:
            by_topic[key] = ng
    return list(by_topic.values())
