---
paths:
  - 'src/modules/**/presentation/**'
  - 'src/modules/**/api/**'
  - 'src/**/*.controller.ts'
---

# Presentation layer

- Use the [V2 module layout](../skills/cw-hexagonal-module-layout/SKILL.md) for HTTP files and webhooks. Apply these rules to existing `api/` paths until migration.
- Expose only routes and fields defined in installed `@cadenway/contracts`. Match paths, statuses
  and error codes.
- Controllers validate and map inputs and outputs around a use case call. Keep logic and repository
  access outside controllers.
- Errors use the common format of `@cadenway/nest-common` with a stable machine `code`.
- Every route requires the internal token (guard of nest-common) and declares with
  `@InternalAccess` the issuers, actors and organization requirement its contract states.
  `api-gateway` is the usual issuer. Only the system `realtime-gateway` without an organization can
  redeem a realtime ticket. Issuing that ticket requires the gateway's verified session user and
  current organization. Personal API token operations require that organization and run in its
  tenant transaction.
- Never return a field the contract does not declare.
