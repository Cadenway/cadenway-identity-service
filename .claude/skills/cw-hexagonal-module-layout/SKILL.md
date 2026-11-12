---
name: cw-hexagonal-module-layout
description: "Where each kind of code goes in a module (domain, application, infrastructure, api), the naming of files and classes, and the dependency direction. Load it before creating or moving a file."
---

# Module layout

```text
src/modules/<module>/
├─ domain/            ← entities, value objects, domain errors, domain events (pure)
├─ application/       ← use cases (commands, queries) and the ports they need
├─ infrastructure/    ← repositories, ORM mapping, external clients, outbox wiring
├─ api/               ← controllers, DTO mapping, event handlers
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
| Use case | `application/change-task-status.ts` | `ChangeTaskStatus` |
| Port | `application/ports/task-repository.ts` | `TaskRepository` (interface) |
| Repository | `infrastructure/persistence/pg-task-repository.ts` | `PgTaskRepository` |
| Controller | `api/tasks.controller.ts` | `TasksController` |
| Event handler | `api/member-removed.handler.ts` | `MemberRemovedHandler` |

Classes carry no `Service` or `Component` suffix unless NestJS requires a provider token name.
