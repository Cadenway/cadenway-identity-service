---
paths:
  - 'src/modules/**/domain/**'
---

# Domain layer

- Plain TypeScript only. Domain depends only on its own domain and runs in a unit test without Nest.
- In V2, group aggregates under `domain/aggregates/<aggregate>/`, value objects under
  `domain/value-objects/<concept>/` and policies, events and errors under
  `domain/{policies,events,errors}/<area>/`. Use at most one named exported type or interface per
  file. Follow checked-out paths in modules awaiting migration.
- An invalid state is impossible to build: constructors and methods refuse it with a typed domain
  error (`class XxxError extends DomainError`), never with a boolean.
- Each rule cites its source in a docblock (mockup screen, integration guide, decision).
- Domain events are plain objects named in the past tense; the application layer records them in
  the outbox.
- No `Date.now()` or random inside the domain: time and ids come in as arguments.
