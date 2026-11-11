# waypoint-identity-service: Claude Code tooling

This `.claude/` folder ships the Claude Code tooling of waypoint-identity-service: **16 agents**,
17 slash commands, 13 rules, 18 skills, 3 hooks, the project
settings and launch configuration. The application launch requires the planned package scripts.

Start from [AGENTS.md](../AGENTS.md) (the rules every assistant follows) and [CLAUDE.md](../CLAUDE.md)
(the Claude entry point).

## Settings (`settings.json`)

- **Hooks** are wired through `${CLAUDE_PROJECT_DIR}` so they resolve from any working directory:
  `guard.mjs` before every `Write` / `Edit` / `MultiEdit`, `guard-git.mjs` before every `Bash` /
  `PowerShell` command, and `format.mjs` after matching edit events for supported files.
  Apply the repository rules across tools.
- **Permissions** allow specific repository commands and read-only Git commands. The project
  denies `Read` on `.env` and `.env.*`. Follow the repository secret-handling rules across tools.
  The project does not pre-approve `git push`, `gh` writes or arbitrary shell commands.
- **Fast mode is off** (`fastMode: false` and `CLAUDE_CODE_DISABLE_FAST_MODE=1`). Agent models and
  efforts are explicit in each agent's frontmatter; do not silently substitute a model.
- **MCP**: `enabledMcpjsonServers` enables `context7` from the root `.mcp.json`.
- **No plugins** are enabled (`enabledPlugins: {}`). The folder is itself a plugin
  (`.claude-plugin/plugin.json`, `hooks/hooks.json`) for installations outside this checkout.

## Working with the sibling repositories

Start from this checkout and attach the peers you need, for example:

```powershell
claude --add-dir ../waypoint-api-contracts ../waypoint-service-kit ../waypoint-ops
```

Their `.claude/agents/` are discovered too, so their `wp-*` roles become available. Peer checkouts
are **read-only** from a waypoint-identity-service session (the guard refuses edits there): change them in their
own session and pull request.

## Agents

Builders write only assigned files, inherit permissions and preserve concurrent work. Reviewers are
read-only: their tools exclude `Edit` and `Write`, and they ask the parent for the output of any
check that writes files. No agent delegates further.

| Agent | Responsibility | Model | Effort | Mode |
| --- | --- | --- | --- | --- |
| `wp-identity-module-explorer` | Map a module: files, invariants, flows, events, dependencies. | sonnet | medium | Read-only |
| `wp-identity-module-builder` | Create a new module skeleton with its MODULE.md. | opus | high | Assigned writes |
| `wp-identity-domain-builder` | Pure domain: entities, value objects, invariants, domain events. | opus | high | Assigned writes |
| `wp-identity-usecase-builder` | Application use cases: orchestration, transactions, outbox. | sonnet | high | Assigned writes |
| `wp-identity-endpoint-builder` | Internal REST routes from the contract. | sonnet | high | Assigned writes |
| `wp-identity-event-builder` | Publish and consume events: outbox, idempotency, versions. | opus | high | Assigned writes |
| `wp-identity-persistence-builder` | Repositories, mapping, queries and indexes. | sonnet | high | Assigned writes |
| `wp-identity-migration-builder` | Expand/contract schema migrations. | sonnet | high | Assigned writes |
| `wp-identity-test-writer` | Unit, integration and contract tests. | sonnet | high | Assigned writes |
| `wp-identity-deploy-maintainer` | Dockerfile, deploy/compose.yaml, health checks, env. | sonnet | medium | Assigned writes |
| `wp-identity-architecture-reviewer` | Layering, ownership, boundaries, contracts. | opus | xhigh | Read-only |
| `wp-identity-contract-reviewer` | Code against OpenAPI and AsyncAPI. | opus | high | Read-only |
| `wp-identity-security-auditor` | Tenant isolation, authorization, input, secrets, personal data. | opus | xhigh | Read-only |
| `wp-identity-observability-reviewer` | Logs, traces, metrics, health. | sonnet | high | Read-only |
| `wp-identity-performance-reviewer` | Queries, indexes, pagination, N+1. | sonnet | high | Read-only |
| `wp-identity-github-maintainer` | Workflows, templates and community files in .github/. | sonnet | medium | Assigned writes |

## Commands

| Command | What it does | Runs |
| --- | --- | --- |
| `/wp-explore` | Map an existing module before changing it. | `wp-identity-module-explorer` |
| `/wp-module` | Create a new module skeleton with its MODULE.md. | `wp-identity-module-builder` |
| `/wp-domain` | Add or change a domain rule (pure TypeScript). | `wp-identity-domain-builder` |
| `/wp-usecase` | Add a use case (command or query). | `wp-identity-usecase-builder` |
| `/wp-endpoint` | Implement an internal route exactly as the contract defines it. | `wp-identity-endpoint-builder` |
| `/wp-event` | Publish or consume an event through the outbox. | `wp-identity-event-builder` |
| `/wp-persistence` | Implement a repository or a query. | `wp-identity-persistence-builder` |
| `/wp-migrate` | Write an expand/contract migration. | `wp-identity-migration-builder` |
| `/wp-tests` | Write unit, integration or contract tests. | `wp-identity-test-writer` |
| `/wp-deploy` | Change the Dockerfile, deploy/compose.yaml or environment variables. | `wp-identity-deploy-maintainer` |
| `/wp-arch-review` | Review layering, ownership and boundaries of the current change. | `wp-identity-architecture-reviewer` |
| `/wp-contract-review` | Compare routes and events with waypoint-api-contracts. | `wp-identity-contract-reviewer` |
| `/wp-security-review` | Audit tenant isolation, authorization and secrets. | `wp-identity-security-auditor` |
| `/wp-observability-review` | Review logs, traces, metrics and health checks. | `wp-identity-observability-reviewer` |
| `/wp-perf-review` | Review queries, indexes and pagination. | `wp-identity-performance-reviewer` |
| `/wp-github` | Change workflows, templates or community files in .github/. | `wp-identity-github-maintainer` |
| `/wp-quality` | Run the local quality gate, stopping at the first failure. | runs the commands itself |

## Rules

| File | Subject | Loads for |
| --- | --- | --- |
| `domain.md` | Domain layer | `src/modules/**/domain/**` |
| `application.md` | Application layer | `src/modules/**/application/**` |
| `infrastructure.md` | Infrastructure layer | `src/modules/**/infrastructure/**` |
| `api.md` | API layer | `src/modules/**/api/**`, `src/**/*.controller.ts` |
| `events.md` | Events | `src/**/*.events.ts`, `src/**/*.handler.ts`, `src/**/*.publisher.ts`, `src/**/events/**` |
| `migrations.md` | Migrations | `migrations/**`, `src/**/migrations/**` |
| `tests.md` | Tests | `**/*.spec.ts`, `test/**` |
| `deploy.md` | Deployment files | `Dockerfile`, `deploy/**`, `compose.dev.yaml`, `.env.example` |
| `module-docs.md` | MODULE.md | `src/modules/**/MODULE.md` |
| `language.md` | Language | always |
| `git-and-commits.md` | Git and commits | always |
| `comments.md` | Comments and docblocks | `src/**/*.ts` |
| `github.md` | GitHub files | `.github/**` |

## Skills

See [skills/](skills/) for the complete inventory, including the technology guides.

| Skill | Use |
| --- | --- |
| `wp-context` | What Waypoint is, where the mockup, the integration guide and the repository map live, the product vocabulary (spaces, lists, sprints, tasks, statuses, milestones) and the multi-repository ownership rules. |
| `wp-identity-domain` | The data, rules, events and screens waypoint-identity-service owns, taken from the mockup, the integration guide and the repositories document. |
| `wp-hexagonal-module-layout` | Where each kind of code goes in a module (domain, application, infrastructure, api), the naming of files and classes, and the dependency direction. |
| `wp-outbox-and-events` | How to publish and consume events reliably with @waypoint/nest-messaging: outbox in the use case transaction, idempotent handlers, retries, dead letters, versioned names. |
| `wp-contract-first` | The order in which a route or an event change travels: waypoint-api-contracts, then the producing service, then gateways and consumers, then the web app; and how to check the installed contract version. |
| `wp-expand-contract-migrations` | How to change a database schema without breaking the running version: expand, dual-write, backfill, contract in a later release, and how to roll back. |
| `wp-nest-testing` | How to write unit, integration and contract tests in a Waypoint NestJS service: Vitest, disposable PostgreSQL and NATS, mockup-based fixtures. |
| `wp-module-md` | The canonical sections of a module MODULE.md and the changes that make updating it mandatory in the same change. |

## Hooks

| Hook | When | What it refuses or does |
| --- | --- | --- |
| `guard.mjs` | before `Write`, `Edit` or `MultiEdit` | Sibling checkouts, generated trees, lockfiles, `.git/`, secrets and tokens, direct NATS clients, `export *` barrels and sibling-source imports, unpinned third-party actions and `pull_request_target` in workflows. |
| `guard-git.mjs` | before `Bash` or `PowerShell` | Pushes to `main`, tag pushes, force-pushes, rewrites of pushed commits, hook bypasses, destructive resets, registry publishing, branch names outside `<type>/<kebab>`. Adapted from the dentalstock guard. |
| `format.mjs` | after a successful `Write`, `Edit` or `MultiEdit` | Formats supported files with the repository's Prettier; a no-op until the formatter is installed. |
