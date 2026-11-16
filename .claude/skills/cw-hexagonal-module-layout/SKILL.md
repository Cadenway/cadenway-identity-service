---
name: cw-hexagonal-module-layout
description: "Place files and review dependencies in the Cadenway V2 module layout."
---

# V2 module layout

Use this layout for new modules and authorized migrations. For an existing module awaiting
migration, follow the paths in its checked-out source and MODULE.md. The existing
`pnpm test:architecture` still uses the installed checker. Adopt strict V2 after the checker is
published and the service is migrated, as described in the
[Cadenway NestJS architecture reference](https://github.com/Cadenway/cadenway-service-kit/blob/main/docs/hexagonal-architecture.md).

```text
src/modules/<module>/
  MODULE.md
  <module>.module.ts
  public/<area>/<operation>.ts
  domain/aggregates/<aggregate>/
  domain/value-objects/<concept>/
  domain/{policies,events,errors}/<area>/
  application/use-cases/{commands,queries}/<area>/<operation>/
  application/{models,projections,mappers,services}/<area>/
  application/ports/outbound/<concern>/<area>/
  presentation/http/{controllers,dto/input,dto/output,mappers,validation,errors,guards}/<resource>/
  presentation/http/webhooks/<provider>/
  presentation/messaging/handlers/<event-family>/
  presentation/jobs/handlers/<job-family>/
  presentation/websocket/gateways/<channel>/
  presentation/cli/commands/<area>/
  infrastructure/persistence/drizzle/{schemas,mappers,repositories,transactions}/<area>/
  infrastructure/messaging/{outbox,rebuild}/<area>/
  infrastructure/jobs/pg-boss/<area>/
  infrastructure/adapters/<integration>/
  composition/tokens/<area>/
  composition/providers/{use-cases,adapters}/<area>/
```

Create the directories the capability uses. Keep kebab-case file stems and the role suffixes
defined by the reference. Keep a use case's `.use-case.ts`, `.input.ts` and `.output.ts` together.
Use at most one named exported type or interface declaration per TypeScript file. Colocate specs
with the source they cover.

Domain is plain TypeScript and depends only on domain. Application is plain TypeScript and
depends on its own application and domain. Presentation validates and maps to application use
cases. Infrastructure implements outbound ports. Composition wires providers with Nest and keeps
the module root focused on module registration.

A public operation file explicitly re-exports one use case provider and any module-local named
types reachable from its `execute` signature. Declare the owner-relative entry path and consumers
in the owner's MODULE.md, name the provider there, and include that provider in Nest exports.
Declare the module wiring entry separately when another module imports it, and import that wiring
from composition. A consuming module binds its own outbound port to the public provider. The
accounts session opener uses the sessions provider and preserves the active system transaction.
