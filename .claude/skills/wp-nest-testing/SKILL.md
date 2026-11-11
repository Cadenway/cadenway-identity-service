---
name: wp-nest-testing
description: "How to write unit, integration and contract tests in a Waypoint NestJS service: Vitest, disposable PostgreSQL and NATS, mockup-based fixtures. Load it before writing a test."
---

# Testing with @waypoint/nest-testing

- **Unit (domain)**: plain Vitest, no Nest module, no container.
- **Integration**: `createTestApp()` from `@waypoint/nest-testing` starts disposable PostgreSQL and NATS
  (Docker), runs migrations and gives a Nest app plus an event recorder. Assert on state and on
  recorded events, never on logs.
- **Contract**: validate each response against the schema of the installed `@waypoint/contracts`.
- **Fixtures**: `fixtures.atelierNord()` (organization, CM, IR, HD, LP), `fixtures.sprint14()`; keep ids
  from the mockup (`WAY-482`) so a failing test reads like the product.
