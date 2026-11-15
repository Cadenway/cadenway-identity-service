---
paths:
  - 'src/modules/**/application/**'
---

# Application layer

- One use case per class, with explicit input and output types; the name says the intent
  (`ChangeTaskStatus`, `ListSprintTasks`).
- A write use case owns its transaction through a unit-of-work port. Load, persist and append
  outgoing events with adapters bound to that same transaction. Keep external HTTP calls outside
  it. A query can use a read port and return a projection without a write transaction.
- A load of tenant data filters on the caller's organization, which comes from the request
  context, never from the payload. Accounts, credentials, codes and sessions belong to no
  organization: a load names the verified actor or an explicit key (an address, a token hash).
- Never re-implement a domain rule here; call the domain method.
- A use case reachable from an event handler is idempotent.
