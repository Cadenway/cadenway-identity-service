---
name: cw-module-md
description: "The canonical sections of a module MODULE.md and the changes that make updating it mandatory in the same change. Load it when a route, an event, a table or an invariant changes."
---

# MODULE.md

```markdown
# <Module>

## Purpose
What it owns, as a short list. One sentence on what it does NOT own.

## Public entry points
| Entry point | Consumers |
Owner-relative paths without `.ts`, exact consumer module names; `None` when there is no consumer.
For V2, use `public/<area>/<operation>` in the table and name the exported Nest provider in this section.
Declare a separate `<module>.module` row when another module imports the Nest module wiring.
For an existing module awaiting migration, document the entry points it actually exposes.

## Owned tables
## API
## Events emitted
## Events consumed
## Invariants
## Transactions
## Decisions
```

The nine sections and their order are those of the
[module template](https://github.com/Cadenway/cadenway-service-kit/blob/main/docs/hexagonal-architecture.md#modulemd-template)
and of `rules/module-docs.md`.

Update it in the same change that adds or moves a public entry point or route, publishes or
retires an event, adds a table, or changes an invariant.
