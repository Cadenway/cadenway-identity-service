---
paths:
  - 'src/modules/**/MODULE.md'
---

# MODULE.md

- Use the nine sections in [cw-module-md](../skills/cw-module-md/SKILL.md).
- In Public entry points, declare owner-relative paths without `.ts` in an `Entry point | Consumers`
  table, with exact consumer module names. Write `None` when the module has no consumers.
- For V2 public entry points, use `public/<area>/<operation>` as the table path and identify the
  named Nest provider exported by the module in the same section. Declare the `<module>.module`
  wiring entry separately when another module imports it. For existing modules awaiting migration,
  document the paths the module actually exposes.
- Update it in the same change that adds or moves an entry point, a route, an event, a table or an
  invariant.
- Normative and short: no file catalog, no restated code.
