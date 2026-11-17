---
paths:
  - 'src/modules/**/domain/**'
---

# Domain layer

- Plain TypeScript only. Domain depends only on its own domain and runs in a unit test without Nest.
- Use the [V2 module layout](../skills/cw-hexagonal-module-layout/SKILL.md) for domain files. Follow checked-out paths until migration.
- An invalid state is impossible to build: constructors and methods refuse it with a typed domain
  error (`class XxxError extends DomainError`), never with a boolean.
- Each rule cites its source in a docblock (mockup screen, integration guide, decision).
- Domain events are plain objects named in the past tense; the application layer records them in
  the outbox.
- No `Date.now()` or random inside the domain: time and ids come in as arguments.
