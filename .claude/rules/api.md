---
paths:
  - 'src/modules/**/api/**'
  - 'src/**/*.controller.ts'
---

# API layer

- A route exists only if it is in the installed `@waypoint/contracts`; its paths, fields, status
  codes and error codes match the spec exactly.
- Controllers validate, map to a use case input, call it, map the output. No logic, no repository.
- Errors use the common format of `@waypoint/nest-common` with a stable machine `code`.
- Every route requires the internal token and the organization context (guards of nest-common).
- Never return a field the contract does not declare.
