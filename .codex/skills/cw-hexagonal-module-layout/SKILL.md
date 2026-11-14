---
name: cw-hexagonal-module-layout
description: "Where each kind of code goes in a module (domain, application, infrastructure, api), the naming of files and classes, and the dependency direction. Load it before creating or moving a file."
---

# Module layout

```text
src/modules/<module>/
├─ domain/                 ← entities, value objects, domain errors, domain events (pure)
├─ application/
│  ├─ commands/            ← write use cases, named by action and subject
│  ├─ queries/             ← read use cases
│  └─ ports/               ← outbound interfaces, `<name>.port.ts`
├─ api/
│  ├─ http/                ← controllers, `<name>.controller.ts`
│  └─ messaging/           ← incoming event and job handlers, `<name>.handler.ts`
├─ infrastructure/
│  ├─ persistence/         ← `<name>.schema.ts` and `<name>.repository.ts`
│  └─ messaging/           ← wire event mapping and outbox adapter
├─ <module>.module.ts
└─ MODULE.md
```

Dependencies point inward: `api → application → domain`, `infrastructure → application/domain`.
Nothing in `domain/` imports another layer.

| Kind | File | Class |
| --- | --- | --- |
| Entity | `domain/task.ts` | `Task` |
| Value object | `domain/task-status.ts` | `TaskStatus` |
| Domain error | `domain/errors.ts` | `MilestoneEstimateError` |
| Use case | `application/commands/change-task-status.ts` | `ChangeTaskStatus` |
| Port | `application/ports/task-unit-of-work.port.ts` | `TaskUnitOfWork` (interface) |
| Schema | `infrastructure/persistence/task.schema.ts` | none |
| Repository | `infrastructure/persistence/drizzle-task.repository.ts` | `DrizzleTaskRepository` |
| Controller | `api/http/tasks.controller.ts` | `TasksController` |
| Event handler | `api/messaging/member-removed.handler.ts` | `MemberRemovedHandler` |

Classes carry no `Service` or `Component` suffix unless NestJS requires a provider token name.

`pnpm test:architecture` enforces these folders and suffixes. The
[architecture reference](https://github.com/Cadenway/cadenway-service-kit/blob/main/docs/hexagonal-architecture.md)
of the service kit is authoritative when this skill and the check disagree.
