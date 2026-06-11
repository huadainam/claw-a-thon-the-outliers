"""Pre-seed cached app analyses into a `seed/` directory.

For each app name: resolve on the stores, run the full pipeline (scrape + classify
+ group), and persist under seed/apps/<app_id>/. The resulting seed/ tree is bundled
into the Docker image and loaded on first startup so popular apps are viewable
instantly without waiting for a live scrape.

Run:  python seed.py [seed_apps.txt]
Needs a working .env (OPENAI_API_KEY / OPENAI_BASE_URL / MODEL_NAME).
"""
import sys
from storage import LocalRegistry, LocalStore
from scraper import resolve_app
from pipeline import run_pipeline

def pick_app(res):
    """Choose the app dict from a resolve result, or None to skip."""
    if res["status"] == "matched":
        return res["app"]
    if res["status"] == "ambiguous" and res.get("suggestions"):
        return res["suggestions"][0]
    return None

def seed(names, seed_dir="seed", resolve_fn=resolve_app, runner=None):
    """Resolve + analyze each app into seed_dir. `runner(store)` defaults to the
    real pipeline; injected in tests. Returns a {seeded, skipped} report."""
    reg = LocalRegistry(data_dir=seed_dir)
    report = {"seeded": [], "skipped": []}
    for name in names:
        res = resolve_fn(name)
        app = pick_app(res)
        if not app:
            report["skipped"].append({"name": name, "status": res.get("status")})
            print(f"SKIP  {name}: {res.get('status')}")
            continue
        app_id = reg.upsert_app(app)
        store = LocalStore(data_dir=seed_dir, app_id=app_id)
        store.save_config(reg.get_app(app_id))
        (runner or (lambda s: run_pipeline(store=s)))(store)
        n, t = len(store.load_reviews()), len(store.load_todos())
        report["seeded"].append({"name": name, "title": app["title"],
                                 "app_id": app_id, "reviews": n, "bugs": t})
        print(f"OK    {name} -> {app['title']}: {n} reviews, {t} bugs")
    reg.set_active(None)  # landing shows the gallery, no app auto-opened
    print(f"\nDone: {len(report['seeded'])} seeded, {len(report['skipped'])} skipped")
    return report

def load_names(path="seed_apps.txt"):
    with open(path, encoding="utf-8") as f:
        return [ln.strip() for ln in f if ln.strip() and not ln.startswith("#")]

if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "seed_apps.txt"
    seed(load_names(path))
