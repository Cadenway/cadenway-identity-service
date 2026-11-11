---
paths:
  - 'src/modules/**/application/**'
---

# Application layer

- One use case per class, with explicit input and output types; the name says the intent
  (`ChangeTaskStatus`, `ListSprintTasks`).
- A use case owns one transaction: load through ports, call the domain, persist, record outgoing
  events in the outbox, commit. No external HTTP call inside the transaction.
- Every load filters on the caller's organization; the organization comes from the request context,
  never from the payload.
- Never re-implement a domain rule here; call the domain method.
- A use case reachable from an event handler is idempotent.
