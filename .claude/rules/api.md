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
  `openapi/internal/identity-service.yaml` accepts the issuer `api-gateway` only. The routes of the
  personal API tokens (create, list, revoke) require an organization, the current one of the
  session, and run in its tenant transaction; every other route requires none and ignores the one
  the token may carry.
- Never return a field the contract does not declare.
