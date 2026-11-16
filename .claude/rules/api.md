---
paths:
  - 'src/modules/**/presentation/**'
  - 'src/modules/**/api/**'
  - 'src/**/*.controller.ts'
---

# Presentation layer

- In V2, group HTTP controllers, input and output DTO mapping, validation, errors and guards
  by resource under `presentation/http/`. Place webhooks in `presentation/http/webhooks/<provider>/`.
- Use the existing `api/` paths for modules awaiting migration. These rules apply to both layouts.

- A route exists only if it is in the installed `@cadenway/contracts`; its paths, fields, status
  codes and error codes match the spec exactly.
- Controllers validate, map to a use case input, call it, map the output. No logic, no repository.
- Errors use the common format of `@cadenway/nest-common` with a stable machine `code`.
- Every route requires the internal token (guard of nest-common) and declares with
  `@InternalAccess` the issuers, actors and organization requirement its contract states. No route
  of this service requires an organization yet: `openapi/internal/identity-service.yaml` accepts
  the issuer `api-gateway` only, with no organization.
- Never return a field the contract does not declare.
