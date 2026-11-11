---
name: wp-module-md
description: "The canonical sections of a module MODULE.md and the changes that make updating it mandatory in the same change. Load it when a route, an event, a table or an invariant changes."
---

# MODULE.md

```markdown
# <Module>

## Purpose
What it owns, as a short list. One sentence on what it does NOT own.

## Owned tables
## Public API
## Events emitted
## Events consumed
## Invariants
## Decisions
```

Update it in the same change that adds or moves a route, publishes or retires an event, adds a
table, or changes an invariant. "I'll update the doc after" is a defect.
