"""
migrate_to_memory.py — Copy all local JSON data → GreenNode AgentBase Memory.

Usage:
  cd review-radar
  STORE_BACKEND=memory MEMORY_ID=<your-memory-id> python migrate_to_memory.py

The script reads every app from LocalRegistry + LocalStore, then writes
the same data into MemoryRegistry + MemoryStore. Safe to re-run — each
document is just overwritten (last event wins in AgentBase).
"""

import sys
import os

def main():
    from config import get_config
    from storage import LocalRegistry, LocalStore, MemoryRegistry, MemoryStore
    from memory_http import MemoryHTTP

    cfg = get_config()

    if cfg.store_backend != "memory":
        print("ERROR: Set STORE_BACKEND=memory before running migration.")
        sys.exit(1)
    if not cfg.memory_id:
        print("ERROR: Set MEMORY_ID=<your-memory-id> before running migration.")
        sys.exit(1)

    http = MemoryHTTP(cfg.memory_base_url)
    local_reg = LocalRegistry()
    mem_reg   = MemoryRegistry(memory_id=cfg.memory_id, http=http)

    registry  = local_reg.load()
    apps      = registry.get("apps", [])
    active    = registry.get("active_app_id")

    print(f"Found {len(apps)} apps in local registry.")
    print(f"Active app: {active}")
    print()

    # Migrate registry
    print("Migrating registry…", end=" ")
    mem_reg._save(registry)
    print("done")

    # Migrate per-app data
    for app in apps:
        app_id = app.get("app_id")
        if not app_id:
            continue

        local = LocalStore(app_id=app_id)
        mem   = MemoryStore(memory_id=cfg.memory_id, http=http, app_id=app_id)

        reviews      = local.load_reviews()
        todos        = local.load_todos()
        meta         = local.load_meta()
        config       = local.load_config()
        proc_ids     = local.load_processed_ids()

        print(f"  [{app_id}] {app.get('title', '?')}")
        print(f"    reviews={len(reviews)}  todos={len(todos)}  meta.status={meta.get('status')}", end="  ")

        mem.save_config(config)
        mem.save_processed_ids(proc_ids)
        mem._save_doc("rr-reviews", reviews)   # bypass append to avoid double-write
        mem.save_todos(todos)
        mem.save_meta(meta)
        print("✓")

    print()
    print(f"Migration complete → memory_id={cfg.memory_id}")
    print("Deploy with: STORE_BACKEND=memory MEMORY_ID=" + cfg.memory_id)


if __name__ == "__main__":
    main()
