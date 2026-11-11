---
paths:
  - 'migrations/**'
  - 'src/**/migrations/**'
---

# Migrations

- Expand/contract: every migration keeps the currently deployed version working.
- A rename or type change spans two releases: add and dual-write, then remove in the next release.
- Never edit a merged migration; write a new one.
- Backfills run in batches, are resumable and do not lock large tables.
- Each migration has a down step when the ORM supports it, and the PR states the rollback plan.
