---
name: cw-nest-testing
description: "How to write unit, integration and contract tests in a Cadenway NestJS service: Vitest, disposable PostgreSQL and NATS, mockup-based fixtures. Load it before writing a test."
---

# Testing with @cadenway/nest-testing

- **Unit (domain)**: plain Vitest, no Nest module, no container.
- **Integration**: `createTestApp()` from `@cadenway/nest-testing` starts disposable PostgreSQL and NATS
  (Docker), runs migrations and gives a Nest app plus an event recorder. Assert on state and on
  recorded events, never on logs.
- **Contract**: validate each response against the schema of the installed `@cadenway/contracts`.
- **Fixtures**: `fixtures.atelierNord()` (organization, CM, IR, HD, LP), `fixtures.sprint14()`; keep ids
  from the mockup (`CAD-482`) so a failing test reads like the product.
