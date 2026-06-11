"""Load the bundled `seed/` cache into the live store on first startup.

The seed directory (produced by seed.py, baked into the image) holds pre-analyzed
apps. On first run the live registry is empty, so we copy each seeded app's data in
through the normal Store/Registry interfaces — which works for either backend
(local files or AgentBase Memory). On later runs the registry is already populated,
so this is a no-op and user changes (e.g. Mark Done) are preserved.
"""
import os
from storage import LocalRegistry, LocalStore

def bootstrap_from_seed(registry, store_factory, seed_dir="seed"):
    """Returns the number of apps loaded (0 if already populated or no seed)."""
    if registry.list_apps():
        return 0
    if not os.path.isdir(os.path.join(seed_dir, "apps")):
        return 0
    seed_reg = LocalRegistry(data_dir=seed_dir)
    apps = seed_reg.list_apps()
    for app in apps:
        app_id = app["app_id"]
        src = LocalStore(data_dir=seed_dir, app_id=app_id)
        registry.upsert_app(app)
        dst = store_factory(app_id)
        dst.save_config(app)
        revs = src.load_reviews()
        if revs:
            dst.append_reviews(revs)
        dst.save_processed_ids(src.load_processed_ids())
        dst.save_todos(src.load_todos())
        dst.save_meta(src.load_meta())
    registry.set_active(None)  # landing shows the gallery, nothing auto-opened
    return len(apps)
