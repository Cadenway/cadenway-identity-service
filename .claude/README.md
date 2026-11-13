# cadenway-identity-service: Claude Code tooling

This `.claude/` folder ships the Claude Code tooling of cadenway-identity-service: **16 agents**,
17 slash commands, 13 rules, 22 skills, 3 hooks, the project
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
claude --add-dir ../cadenway-api-contracts ../cadenway-service-kit ../cadenway-ops
```

Their `.claude/agents/` are discovered too, so their `cw-*` roles become available. Peer checkouts
are **read-only** from a cadenway-identity-service session (the guard refuses edits there): change them in their
own session and pull request.

## Agents

Builders write only assigned files, inherit permissions and preserve concurrent work. Reviewers are
read-only: their tools exclude `Edit` and `Write`, and they ask the parent for the output of any
check that writes files. No agent delegates further.

| Agent | Responsibility | Model | Effort | Mode |
| --- | --- | --- | --- | --- |
| `cw-identity-module-explorer` | Map a module: files, invariants, flows, events, dependencies. | sonnet | medium | Read-only |
| `cw-identity-module-builder` | Create a new module skeleton with its MODULE.md. | opus | high | Assigned writes |
| `cw-identity-domain-builder` | Pure domain: entities, value objects, invariants, domain events. | opus | high | Assigned writes |
| `cw-identity-usecase-builder` | Application use cases: orchestration, transactions, outbox. | sonnet | high | Assigned writes |
| `cw-identity-endpoint-builder` | Internal REST routes from the contract. | sonnet | high | Assigned writes |
| `cw-identity-event-builder` | Publish and consume events: outbox, idempotency, versions. | opus | high | Assigned writes |
| `cw-identity-persistence-builder` | Repositories, mapping, queries and indexes. | sonnet | high | Assigned writes |
| `cw-identity-migration-builder` | Expand/contract schema migrations. | sonnet | high | Assigned writes |
| `cw-identity-test-writer` | Unit, integration and contract tests. | sonnet | high | Assigned writes |
| `cw-identity-deploy-maintainer` | Dockerfile, deploy/compose.yaml, health checks, env. | sonnet | medium | Assigned writes |
| `cw-identity-architecture-reviewer` | Layering, ownership, boundaries, contracts. | opus | xhigh | Read-only |
| `cw-identity-contract-reviewer` | Code against OpenAPI and AsyncAPI. | opus | high | Read-only |
| `cw-identity-security-auditor` | Tenant isolation, authorization, input, secrets, personal data. | opus | xhigh | Read-only |
| `cw-identity-observability-reviewer` | Logs, traces, metrics, health. | sonnet | high | Read-only |
| `cw-identity-performance-reviewer` | Queries, indexes, pagination, N+1. | sonnet | high | Read-only |
| `cw-identity-github-maintainer` | Workflows, templates and community files in .github/. | sonnet | medium | Assigned writes |

## Commands

| Command | What it does | Runs |
| --- | --- | --- |
| `/cw-explore` | Map an existing module before changing it. | `cw-identity-module-explorer` |
| `/cw-module` | Create a new module skeleton with its MODULE.md. | `cw-identity-module-builder` |
| `/cw-domain` | Add or change a domain rule (pure TypeScript). | `cw-identity-domain-builder` |
| `/cw-usecase` | Add a use case (command or query). | `cw-identity-usecase-builder` |
| `/cw-endpoint` | Implement an internal route exactly as the contract defines it. | `cw-identity-endpoint-builder` |
| `/cw-event` | Publish or consume an event through the outbox. | `cw-identity-event-builder` |
| `/cw-persistence` | Implement a repository or a query. | `cw-identity-persistence-builder` |
| `/cw-migrate` | Write an expand/contract migration. | `cw-identity-migration-builder` |
| `/cw-tests` | Write unit, integration or contract tests. | `cw-identity-test-writer` |
| `/cw-deploy` | Change the Dockerfile, deploy/compose.yaml or environment variables. | `cw-identity-deploy-maintainer` |
| `/cw-arch-review` | Review layering, ownership and boundaries of the current change. | `cw-identity-architecture-reviewer` |
| `/cw-contract-review` | Compare routes and events with cadenway-api-contracts. | `cw-identity-contract-reviewer` |
| `/cw-security-review` | Audit tenant isolation, authorization and secrets. | `cw-identity-security-auditor` |
| `/cw-observability-review` | Review logs, traces, metrics and health checks. | `cw-identity-observability-reviewer` |
| `/cw-perf-review` | Review queries, indexes and pagination. | `cw-identity-performance-reviewer` |
| `/cw-github` | Change workflows, templates or community files in .github/. | `cw-identity-github-maintainer` |
| `/cw-quality` | Run the local quality gate, stopping at the first failure. | runs the commands itself |

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
| `cw-context` | What Cadenway is, where the mockup, the integration guide and the repository map live, the product vocabulary (spaces, lists, sprints, tasks, statuses, milestones) and the multi-repository ownership rules. |
| `cw-identity-domain` | The data, rules, events and screens cadenway-identity-service owns, taken from the mockup, the integration guide and the repositories document. |
| `cw-hexagonal-module-layout` | Where each kind of code goes in a module (domain, application, infrastructure, api), the naming of files and classes, and the dependency direction. |
| `cw-outbox-and-events` | How to publish and consume events reliably with @cadenway/nest-messaging: outbox in the use case transaction, idempotent handlers, retries, dead letters, versioned names. |
| `cw-contract-first` | The order in which a route or an event change travels: cadenway-api-contracts, then the producing service, then gateways and consumers, then the web app; and how to check the installed contract version. |
| `cw-expand-contract-migrations` | How to change a database schema without breaking the running version: expand, dual-write, backfill, contract in a later release, and how to roll back. |
| `cw-nest-testing` | How to write unit, integration and contract tests in a Cadenway NestJS service: Vitest, disposable PostgreSQL and NATS, mockup-based fixtures. |
| `cw-module-md` | The canonical sections of a module MODULE.md and the changes that make updating it mandatory in the same change. |
| `cw-database-conventions` | The PostgreSQL conventions every Cadenway service follows: table and column naming, the common columns, row-level security, enumerations, pool size and timeouts. |
| `cw-logging-and-tracing` | How a Cadenway backend logs, traces and measures itself: the log fields, what is masked, trace propagation over HTTP and NATS, the ESM start-up flags and the metrics. |
| `cw-jobs` | How to run durable background work with @cadenway/nest-jobs (pg-boss in the service database): the job enqueued in the use case transaction, one key per occurrence, bounded retries, the dead-letter queue. |
| `cw-identity-security` | The security parameters cadenway-identity-service applies: sessions and tokens, argon2id and the password policy, TOTP, WebAuthn, the hardened SAML profile, lockout and code lifetimes. |

## Hooks

| Hook | When | What it refuses or does |
| --- | --- | --- |
| `guard.mjs` | before `Write`, `Edit` or `MultiEdit` | Sibling checkouts, generated trees, lockfiles, `.git/`, secrets and tokens, direct NATS clients, `export *` barrels and sibling-source imports, unpinned third-party actions and `pull_request_target` in workflows. |
| `guard-git.mjs` | before `Bash` or `PowerShell` | Pushes to `main`, tag pushes, force-pushes, rewrites of pushed commits, hook bypasses, destructive resets, registry publishing, branch names outside `<type>/<kebab>`. Adapted from the dentalstock guard. |
| `format.mjs` | after a successful `Write`, `Edit` or `MultiEdit` | Formats supported files with the repository's Prettier; a no-op until the formatter is installed. |
