---
paths:
  - 'src/modules/**/domain/**'
---

# Domain layer

- Plain TypeScript only: no NestJS decorator, no ORM entity, no import from `infrastructure/`, `api/`
  or `@nestjs/*`. The domain must run in a unit test without a Nest module.
- An invalid state is impossible to build: constructors and methods refuse it with a typed domain
  error (`class XxxError extends DomainError`), never with a boolean.
- Each rule cites its source in a docblock (mockup screen, integration guide, decision).
- Domain events are plain objects named in the past tense; the application layer records them in
  the outbox.
- No `Date.now()` or random inside the domain: time and ids come in as arguments.
