---
paths:
  - 'src/modules/**/application/**'
---

# Application layer

- Application is plain TypeScript. Keep Nest decorators, transport DTOs and exceptions, ORM and
  adapter dependencies at the edges.
- Use the [V2 module layout](../skills/cw-hexagonal-module-layout/SKILL.md) for operations and ports. Follow checked-out paths until migration.
- One use case per class, with explicit input and output types; the name says the intent
  (`SignInWithPassword`, `GetUser`). Use at most one named exported type or interface per file
  in V2. A public use case's `execute` signature uses primitives or types explicitly re-exported by
  its public entry point.
- A write use case owns its transaction through a unit-of-work port. Load, persist and append
  outgoing events with adapters bound to that same transaction. Keep external HTTP calls outside
  it. A query can use a read port and return a projection without a write transaction.
- A load of tenant data filters on the caller's organization, which comes from the request
  context, never from the payload. Accounts, credentials, codes and sessions belong to no
  organization (a session only names its current one): a load names the verified actor or an
  explicit key (an address, a token hash). The one organization a payload names is the choice of
  the current organization of a session, which the copy of the memberships checks against the
  verified actor before anything is written.
- Never re-implement a domain rule here; call the domain method.
- A use case reachable from an event handler is idempotent.
- Use a consumer-owned outbound port for cross-module calls. The accounts module calls sessions
  through its session opener port. Session creation joins the existing system transaction.
