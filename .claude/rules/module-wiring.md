---
paths:
  - 'src/modules/**/public/**'
  - 'src/modules/**/composition/**'
  - 'src/modules/**/*.module.ts'
---

# Module wiring

- Keep small bindings, symbol tokens and factories in the root `<module>.module.ts`. When splitting
  the NestJS wiring into separate files, use the optional `composition/tokens/<area>/` and
  `composition/providers/{use-cases,adapters}/<area>/` directories.
- A V2 `public/<area>/<operation>.ts` file uses named re-exports for the provider and any named
  module-local types reachable from its `execute` signature, including nested properties and
  generic arguments. The owner declares the entry path, provider and consumers in MODULE.md and
  includes the provider in the Nest module's exports. Composition alone imports another module's
  declared wiring entry.
- Bind a cross-module dependency in the consumer's composition against its own outbound port.
  For accounts calling sessions, preserve the system transaction shared by the two use cases.
- Follow the checked-out wiring and public entry points for modules awaiting migration.
