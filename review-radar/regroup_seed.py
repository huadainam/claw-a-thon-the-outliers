"""Re-group the bundled seed apps using LLM topic canonicalization.

One-time maintenance: applies canonicalize_topics to each seeded app's existing
reviews and rebuilds its bug to-do list so similar topics cluster into real
Medium/Critical bugs. Cheap — no re-scrape, ~1 LLM call per app.

Run:  python regroup_seed.py
"""
import sys
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from storage import LocalRegistry, LocalStore
from pipeline import _regroup
from canonicalize import canonicalize_topics

def regroup_seed(seed_dir="seed"):
    reg = LocalRegistry(data_dir=seed_dir)
    cfn = lambda topics, preferred: canonicalize_topics(topics, preferred=preferred)
    for app in reg.list_apps():
        store = LocalStore(data_dir=seed_dir, app_id=app["app_id"])
        store.save_todos([])  # rebuild from scratch with canonical topics
        todos = _regroup(store, cfn)
        sev = {}
        for t in todos:
            sev[t["severity"]] = sev.get(t["severity"], 0) + 1
        print(f"{app['title']}: {len(todos)} bug groups {sev}", flush=True)

if __name__ == "__main__":
    regroup_seed()
    print("done", flush=True)
