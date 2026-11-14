---
paths:
  - 'src/modules/**/MODULE.md'
---

# MODULE.md

- Sections: Purpose, Public entry points, Owned tables, API, Events emitted, Events consumed,
  Invariants, Transactions, Decisions. Use the [module template](https://github.com/Cadenway/cadenway-service-kit/blob/main/docs/hexagonal-architecture.md#modulemd-template).
- In Public entry points, declare owner-relative paths without `.ts` in an `Entry point | Consumers`
  table, with exact consumer module names. Write `None` when the module has no consumers.
- Update it in the same change that adds or moves a route, an event, a table or an invariant.
- Normative and short: no file catalog, no restated code.
