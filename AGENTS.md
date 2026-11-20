# cadenway-identity-service: agent instructions

These instructions are mandatory for every AI assistant working in this repository, whatever the
vendor. [CLAUDE.md](CLAUDE.md) imports them for Claude Code. Explicit user instructions take
precedence over procedures, never over the hard limits below.

This file states the **rules**. See the tooling guides for [Claude Code](.claude/README.md)
and [Codex](.codex/README.md) for agents, skills, commands and hooks.

## First read

- Before module edits, read its `MODULE.md`, the installed `@cadenway/contracts` entry and the
  `cw-identity-domain` skill. Use `src/app.module.ts` for module inventory.
- For HTTP and events, consult `../cadenway-api-contracts/openapi/internal/identity-service.yaml`
  or `../cadenway-api-contracts/asyncapi/identity-service.yaml` as applicable. Use `cw-contract-first`
  before adding or changing either.
- For product decisions, use the repository's section of the repositories document and the
  integration guide's data model. See [References](#references).
- The mockup screens this service serves: Main, Inscription, Mfa, Otp, MotDePasseOublie, Reinitialisation, Deconnexion; Compte › Profil, Sécurité, Préférences, Jetons d’API; Organisation › Sécurité et SSO.
- Use `package.json` for available scripts and versions. Keep versions in the manifest.

## What this repository is

cadenway-identity-service owns who the user is and how they sign in. The local port is 3010. Its NestJS runtime uses a
service-owned PostgreSQL database with separate migrator and application roles, NATS JetStream
via `@cadenway/nest-messaging`, and internal REST.

Check the checkout for implemented capabilities. See the [ownership and contract map](docs/architecture.md#purpose-and-target-structure)
for data, APIs, emitted and consumed events, external systems and rollout.

Decided: this service is built in NestJS, without an existing identity provider (Keycloak, Zitadel, Ory). Its security parameters are fixed in the `cw-identity-security` skill. Organizations and members belong to cadenway-organization-service from the start.

## Language

- Everything written in the repository is **English**: code, comments, docs, agent prompts, rules,
  skills, commit messages, branch names, PR titles and descriptions.
- Follow the user's language in the conversation only. No emojis.
- Never invent facts about the product, the contracts, the mockup or the tooling: cite the file or
  the document. When something does not exist yet, say so and say which step of the start-up plan
  brings it.

## Architectural ownership

- Read `cw-hexagonal-module-layout` before placing files. Use `MODULE.md` for public paths and
  consumers, and bind cross-module calls through consumer-owned ports. Keep TypeScript strict
  with explicit types and `readonly`, without `any` or non-null assertions.
- Use V2 for new modules and explicit migrations. Existing modules follow the paths in source and
  `MODULE.md` until migrated. Adopt the strict checker in the migration once a published
  `@cadenway/nest-testing` version includes `convention: 'strict'`. Run the configured architecture
  check for source changes.
- The accounts-owned session opener joins the active system transaction.
- `src/infrastructure/` holds the few adapters several modules bind to their own ports (the system clock); it holds no business rule and imports no module.
- Domain and application are pure TypeScript. Write use cases own transactions. Presentation
  adapters validate, map and delegate. Dependencies point inward. Scope tenant reads to the
  organization in the verified request context. Account, code and session queries use the verified
  actor or an explicit key. A session only names its current organization. See
  `cw-database-conventions` for system transactions and tenant exceptions.
- Follow the scoped application and event rules for the transactional outbox, idempotent
  handlers and versioned shapes. Use expand/contract migrations that keep the running version
  working, per the migration rule.
- Use cadenway-service-kit for shared runtime plumbing. [Cadenway tooling](https://github.com/Cadenway/cadenway-tooling)
  owns the development-only `@cadenway/nest-testing` package. The webapp renders user-facing
  output. This service returns data and stable error codes.

## Boundaries (hard rules)

- No access to another service's database or internal code; cross-service needs use `@cadenway/contracts` routes or events.
- NATS only through `@cadenway/nest-messaging`; config, logs, errors, health and auth guards through `@cadenway/nest-common`.
- Routes and event payloads come from the installed `@cadenway/contracts`; never redefine them locally.
- The service is internal: no Traefik label, no public route. Its HTTP callers are the API gateway, the realtime gateway (ticket redemption), and Notification (recipient lookup).
- No sibling sources imported, no `file:` or `link:` dependency on a sibling.

## GitHub files (`.github/`)

Use the matching `github.md` rule in the active assistant's rules directory for files,
workflows and cross-repository changes. [`.github/README.md`](.github/README.md) is the
repository home page. Keep CI, release and deploy workflows and Renovate configuration
complete in this repository. Use local Renovate settings without a shared preset.
Shared changes ship through each owning repository's pull request.

## Code quality

- Read the affected entry point, its callers, and its relevant tests before editing.
  Preserve the behavior callers rely on unless the task changes it.
- Keep the diff focused. Use names that express intent and reuse existing code when
  it preserves the required behavior. Extract code when it clarifies a responsibility.
- Keep business decisions with their owning module. Validate external inputs at the
  boundary and use documented public interfaces across modules and repositories.
- For writes that can fail, overlap, or be retried, verify the resulting state.
  Check transaction boundaries, tenant scope, and repeated delivery where relevant.
- For collections and repeated work, check what grows with input size. Measure or
  inspect the bottleneck before adding an index, cache, worker, or replica.
- Run the repository checks that cover the affected behavior. Report the commands
  and their results, including checks that did not run and tests that selected zero cases.

## Commands and quality gates

Use the [minimum checks by change](docs/development.md#minimum-checks-by-change) and the
[full local quality gate](docs/development.md#full-local-quality-gate). Use the documented
scripts or add them under those names during bootstrap. Start with the narrowest check.

For routes, use `pnpm test <module>/presentation` in V2 or `pnpm test <module>/api` in the
existing layout, then the contract tests. Report results for commands run and identify
unrun checks.

## Git and branch flow

Branch from `main` and validate with `git check-ref-format --branch <name>`. Follow the
matching `git-and-commits.md` rule for branch names, Conventional Commits and scoped staging.

Pull requests target `main` and squash-merge after review and green CI. release-please opens
the release PR. Its merge tags and publishes the GHCR image. [The deploy workflow](.github/workflows/deploy.yml)
updates cadenway-ops staging, then production after approval.

## Hard limits (never without the user's explicit request in this conversation)

- Never push to `main`, merge into it locally, create or push Git tags, or bump a version by hand.
- Never run a registry publish (`npm publish`, `pnpm publish`): this repository ships as a Docker image built by CI.
- Never force-push, and never amend or rebase commits that are already pushed.
- Never bypass the Git hooks (`--no-verify`, `core.hooksPath` overrides, `ALLOW_MAIN_PUSH=1`,
  `CW_SKIP_PUSH_CHECKS=1`).
- Never write a token, password or private key anywhere; `.npmrc` keeps `${NODE_AUTH_TOKEN}`. Do
  not read or write secret environment files; new variables are documented in `.env.example`.
- Never edit generated trees (`dist/`, `node_modules/`, `coverage/`, generated clients) or lockfiles by hand.
- Never modify a sibling checkout (`../cadenway-*`) from a task in this repository.
- Never write into another service's database, even for a "quick fix".
- Never edit a merged migration.

The agent hooks enforce most of these mechanically; a refused command is a signal to stop and ask,
not to find another way around it.

## Agent tooling

Use the [Codex](.codex/README.md) or [Claude Code](.claude/README.md) guide to find specialists,
commands, skills and hooks. Read the applicable scoped rules for the active assistant.

Specialists are optional. Assign bounded, disjoint files and checks to builders. Keep reviewers
read-only and integrate their results.

## Repository hygiene

- Reuse existing commands, tools and test infrastructure before adding files.
- Prefer inline commands or a task-specific temporary directory for one-off diagnostics; clean up
  disposable files before delivery.
- Keep a permanent script only when it provides a reusable capability that existing tooling cannot.
- Add permanent tests for meaningful behavior or regressions, in the existing test structure.
- Before delivery, inspect untracked files and remove only the disposable artifacts of the current
  task. Report every new permanent tooling file and why it needs to stay.
- Report material failures, skipped checks and limitations, including non-blocking ones. Ask for
  user input only when a missing decision or authorization blocks the dependent work.

## References

- [Interactive mockup](https://claude.ai/artifact/KYRM7AnsYLiBLBLKy8i4HE), [integration guide](https://claude.ai/artifact/CpJHVCiFfF9j3KbHQ2S1Et) and
  [repositories and packages](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N) (living documents).
