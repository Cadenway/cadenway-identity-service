---
name: cw-expand-contract-migrations
description: "How to change a database schema without breaking the running version: expand, dual-write, backfill, contract in a later release, and how to roll back. Load it for every migration."
---

# Expand/contract migrations

| Change | Release N | Release N + 1 |
| --- | --- | --- |
| Add a column | Add it nullable or with a default | Make it required if needed |
| Rename a column | Add the new one, write both, read the new one | Drop the old one |
| Change a type | Add a new column of the new type, backfill, dual-write | Drop the old one |
| Drop a column | Stop reading and writing it | Drop it |
| Add an index | Create it concurrently when the database supports it | — |

Rollback: reverting the deployment must leave release N − 1 working on the expanded schema. That is
why the destructive step always waits for the next release.
