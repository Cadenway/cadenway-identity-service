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
- **Containers**: the disposable PostgreSQL and NATS are Testcontainers started by
  `@cadenway/nest-testing`; a service never depends on `testcontainers` itself.
- **Third parties**: external HTTP systems (Stripe, GitHub, GitLab, identity providers) are faked
  with `msw` through `@cadenway/nest-testing`; a test never reaches the network.
- **Properties**: a domain rule with a wide input space also gets a property test, with `fast-check`
  through `@fast-check/vitest` (`test.prop`). A counterexample found once becomes a named example
  test.
