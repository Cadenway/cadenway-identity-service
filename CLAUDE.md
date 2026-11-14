# cadenway-identity-service: Claude Code instructions

> **Source of truth.** This file is the entry point for Claude Code. The normative rules live in
> [AGENTS.md](AGENTS.md), imported below: read it, do not paraphrase it from memory.

@AGENTS.md

> **Read on demand, deliberately not `@`-imported**: the module `MODULE.md` files, `../cadenway-api-contracts` (`openapi/internal/identity-service.yaml`, `asyncapi/identity-service.yaml`), the [repositories document](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N). Importing them would
> cost context in every session. The path-scoped rules in `.claude/rules/` load automatically when
> you open a matching file and carry the few things that must never be got wrong there.

## TL;DR for every task

1. Read before writing: the touched module's `MODULE.md`, the matching contract in `@cadenway/contracts`, the `cw-identity-domain` skill.
2. Contract first: a route or an event that is not in the installed `@cadenway/contracts` is not written; the change starts in cadenway-api-contracts.
3. Layering: pure domain, write use cases own their transaction, controllers and handlers only map. Dependencies point inward.
4. Own data only: this service reads and writes its own database; everything else goes through contracts and events.
5. Every query is scoped by organization; the organization comes from the request context.
6. Events go through the outbox of `@cadenway/nest-messaging`; handlers are idempotent; shape changes get a new version.
7. Migrations are expand/contract: the running version keeps working.
8. Strict TypeScript: explicit types, `readonly`, no `any`, no non-null assertion.

## Boundaries (hard rules)

- No access to another service's database or internal code; cross-service needs use `@cadenway/contracts` routes or events.
- NATS only through `@cadenway/nest-messaging`; config, logs, errors, health and auth guards through `@cadenway/nest-common`.
- Routes and event payloads come from the installed `@cadenway/contracts`; never redefine them locally.
- The service is internal: no Traefik label, no public route; the API gateway is its only HTTP caller.
- No sibling sources imported, no `file:` or `link:` dependency on a sibling.

## Target quality gate

Use the [minimum checks by change](docs/development.md#minimum-checks-by-change) first.
Run `/cw-quality` without arguments for the full local gate when applicable. Report unavailable
checks during bootstrap.

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm test:integration                    # PostgreSQL and NATS in Docker
pnpm build
docker compose -f compose.dev.yaml config -q
```

While the repository is being bootstrapped, a missing script is reported as not available, never replaced by an ad-hoc command.

## Tooling: this repository ships its own `.claude/`

Open `cadenway-identity-service/` as the workspace root to activate it. The `cw-identity-*` agents, the `/cw-*`
commands, the skills and the hooks are described in [.claude/README.md](.claude/README.md). Two things
the session listing does not tell you:

- **Rules** in `.claude/rules/` load at session start unless they declare `paths`. Scoped rules
  load when Claude reads a matching file.
- **Hooks** cover the edit and shell tool events matched in `.claude/settings.json`.
  `guard.mjs` refuses edits that break a hard rule
  (generated trees, lockfiles, secrets, sibling checkouts, direct NATS clients, `export *` barrels and sibling-source imports, unpinned third-party actions and `pull_request_target` in workflows), `guard-git.mjs`
  refuses pushes to `main`, tag pushes, force-pushes, rewrites of pushed commits, hook bypasses and
  registry publishing, and `format.mjs` formats supported files when its formatter is available.
  Apply the repository rules across tools. Resolve a refusal without bypassing the hook.

The sibling repositories (`../cadenway-api-contracts`, `../cadenway-service-kit`, `../cadenway-ops`, `../cadenway-api-gateway`) are read-only references
from here; add them to the session (`--add-dir`) when a task needs to read them.
