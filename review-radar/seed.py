"""Pre-seed cached app analyses into a `seed/` directory.

For each app name: resolve on the stores, run the full pipeline (scrape + classify
+ group), and persist under seed/apps/<app_id>/. The resulting seed/ tree is bundled
into the Docker image and loaded on first startup so popular apps are viewable
instantly without waiting for a live scrape.

Resumable: apps that already have cached reviews are skipped, so re-running only
processes new or previously-empty apps. Apps that end with 0 reviews are pruned.

Run:  python seed.py [seed_apps.txt]
Needs a working .env (OPENAI_API_KEY / OPENAI_BASE_URL / MODEL_NAME).
"""
import sys
import time

# On Windows, stdout redirected to a file defaults to cp1252 and crashes on
# Vietnamese characters — force UTF-8.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from storage import LocalRegistry, LocalStore
from scraper import resolve_app
from pipeline import run_pipeline

SLEEP_BETWEEN = 2.0  # seconds, to avoid store rate-limiting across many apps

def pick_app(res):
    """Choose the app dict from a resolve result, or None to skip."""
    if res["status"] == "matched":
        return res["app"]
    if res["status"] == "ambiguous" and res.get("suggestions"):
        return res["suggestions"][0]
    return None

def seed(names, seed_dir="seed", resolve_fn=resolve_app, runner=None, sleep=0.0):
    """Resolve + analyze each app into seed_dir. `runner(store)` defaults to the
    real pipeline; injected in tests. Resumable and self-pruning. Returns a report."""
    reg = LocalRegistry(data_dir=seed_dir)
    report = {"seeded": [], "skipped": [], "empty": []}
    for name in names:
        try:
            res = resolve_fn(name)
            app = pick_app(res)
            if not app:
                report["skipped"].append({"name": name, "status": res.get("status")})
                print(f"SKIP  {name}: {res.get('status')}", flush=True)
                continue
            app_id = reg.upsert_app(app)
            store = LocalStore(data_dir=seed_dir, app_id=app_id)
            if store.load_reviews():  # resume: already seeded
                n, t = len(store.load_reviews()), len(store.load_todos())
                report["seeded"].append({"name": name, "title": app["title"],
                                         "app_id": app_id, "reviews": n, "bugs": t})
                print(f"HAVE  {name} -> {app['title']}: {n} reviews (skip)", flush=True)
                continue
            store.save_config(reg.get_app(app_id))
            (runner or (lambda s: run_pipeline(store=s)))(store)
            n, t = len(store.load_reviews()), len(store.load_todos())
            if n == 0:
                report["empty"].append({"name": name, "title": app["title"], "app_id": app_id})
                print(f"EMPTY {name} -> {app['title']}: 0 reviews", flush=True)
            else:
                report["seeded"].append({"name": name, "title": app["title"],
                                         "app_id": app_id, "reviews": n, "bugs": t})
                print(f"OK    {name} -> {app['title']}: {n} reviews, {t} bugs", flush=True)
        except Exception as e:
            report["skipped"].append({"name": name, "status": f"error: {e!r}"[:160]})
            print(f"ERR   {name}: {e!r}"[:200], flush=True)
        if sleep:
            time.sleep(sleep)

    _prune_empty(reg, seed_dir)
    reg.set_active(None)  # landing shows the gallery, nothing auto-opened
    print(f"\nDone: {len(report['seeded'])} seeded, {len(report['empty'])} empty(pruned), "
          f"{len(report['skipped'])} skipped", flush=True)
    return report

def _prune_empty(reg, seed_dir):
    """Remove registered apps whose store has no reviews."""
    keep = []
    for app in reg.list_apps():
        store = LocalStore(data_dir=seed_dir, app_id=app["app_id"])
        if store.load_reviews():
            keep.append(app)
    data = reg.load()
    data["apps"] = keep
    reg._save(data)

def load_names(path="seed_apps.txt"):
    with open(path, encoding="utf-8") as f:
        return [ln.strip() for ln in f if ln.strip() and not ln.startswith("#")]

if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "seed_apps.txt"
    seed(load_names(path), sleep=SLEEP_BETWEEN)
