---
paths:
  - '**/*.spec.ts'
  - 'test/**'
---

# Tests

- Vitest. Specs sit next to their subject; integration specs end in `.int-spec.ts` and run with
  `pnpm test:integration`.
- Domain tests are pure; integration tests use real PostgreSQL and NATS from `@waypoint/nest-testing`.
- Name tests after the behavior and the rule (`refuses a milestone with an estimate`).
- Fixtures come from the mockup data: Atelier Nord, Camille Martin (CM), Sprint 14, WAY-482.
- Never mock the database in an integration test; never assert on log text.
