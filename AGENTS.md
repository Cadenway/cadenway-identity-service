# waypoint-identity-service: agent instructions

These instructions are mandatory for every AI assistant working in this repository, whatever the
vendor. [CLAUDE.md](CLAUDE.md) imports them for Claude Code. Explicit user instructions take
precedence over procedures, never over the hard limits below.

This file states the **rules**. See the tooling guides for [Claude Code](.claude/README.md)
and [Codex](.codex/README.md) for agents, skills, commands and hooks.

## First read

- The `MODULE.md` of the module you touch, and `src/app.module.ts` for the module list.
- `@waypoint/contracts` (installed) and `../waypoint-api-contracts`: `openapi/internal/identity-service.yaml` and `asyncapi/identity-service.yaml`.
- The [repositories document](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N), section "waypoint-identity-service", and the data model of the [integration guide](https://claude.ai/artifact/CpJHVCiFfF9j3KbHQ2S1Et).
- The mockup screens this service serves: Main, Inscription, Mfa, Otp, MotDePasseOublie, Reinitialisation, Deconnexion; Compte › Profil, Sécurité, Préférences, Jetons d’API; Organisation › Sécurité et SSO.
- `package.json` for versions and scripts once the repository is bootstrapped. Do not restate
  versions elsewhere: a copy goes stale.

## What this repository is

The structure and workflows below describe the bootstrap target. Check the checkout for available files and commands.

waypoint-identity-service owns who the user is and how they sign in. NestJS, its own PostgreSQL database (one database and one user in the shared PostgreSQL of the VPS), events over NATS JetStream through `@waypoint/nest-messaging`, internal REST for the API gateway. Local port 3010.

|            |                                                                                                                                                                                                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Data       | Users, hashed passwords, MFA factors (authenticator app, security keys, recovery codes), linked accounts (Google, GitHub, Microsoft, GitLab), SAML SSO connections per organization, sessions, personal API tokens, one-time codes and links, profile and preferences (theme, language, density, personal status). |
| API        | Sign-in, sign-up, MFA, one-time codes, password reset, sessions (list, revoke), API tokens, profile, preferences. Issues the tokens the gateways verify.                                                                                                                                                           |
| Emits      | `user.signed-up`, `user.email-verified`, `user.status-changed`, `session.revoked`, `api-token.created`, `api-token.revoked`                                                                                                                                                                                        |
| Listens to | `member.removed` (closes the user's sessions in that organization)                                                                                                                                                                                                                                                 |
| External   | OAuth providers, customers' SAML identity providers, WebAuthn for security keys.                                                                                                                                                                                                                                   |
| Phase      | First version                                                                                                                                                                                                                                                                                                      |

Open decision: build this service or rely on an existing identity provider (Keycloak, Zitadel, Ory). Until it is settled, keep the identity provider behind one port so the choice stays reversible. At start-up this service also carries the organizations and members module, extracted later into waypoint-organization-service.

## Language

- Everything written in the repository is **English**: code, comments, docs, agent prompts, rules,
  skills, commit messages, branch names, PR titles and descriptions.
- Follow the user's language in the conversation only. No emojis.
- Never invent facts about the product, the contracts, the mockup or the tooling: cite the file or
  the document. When something does not exist yet, say so and say which step of the start-up plan
  brings it.

## Architectural ownership

- Business code lives in modules under `src/modules/<module>/`, each with `domain/`, `application/`, `infrastructure/`, `api/` and a `MODULE.md`.
- Cross-cutting plumbing (config, logging, tracing, errors, auth guards, messaging) comes from the waypoint-service-kit packages (`@waypoint/nest-common`, `@waypoint/nest-messaging`, `@waypoint/nest-testing`), never re-implemented here.
- The domain is pure; use cases own transactions; controllers and handlers translate.
- Rendering of anything user-facing belongs to the webapp; this service returns data and stable error codes.

## Boundaries (hard rules)

- No access to another service's database or internal code; cross-service needs use `@waypoint/contracts` routes or events.
- NATS only through `@waypoint/nest-messaging`; config, logs, errors, health and auth guards through `@waypoint/nest-common`.
- Routes and event payloads come from the installed `@waypoint/contracts`; never redefine them locally.
- The service is internal: no Traefik label, no public route; the API gateway is its only HTTP caller.
- No sibling sources imported, no `file:` or `link:` dependency on a sibling.

## GitHub files (`.github/`)

This repository carries everything GitHub reads from it; Waypoint has no organization `.github`
repository and nothing is inherited.

- [`.github/README.md`](.github/README.md) is the repository home page; `CONTRIBUTING.md`,
  `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`, `PULL_REQUEST_TEMPLATE.md`, `ISSUE_TEMPLATE/` and
  `CODEOWNERS` sit next to it.
- `.github/workflows/` holds this repository's complete CI, release and deploy workflows: no reusable
  workflow from another repository. The Renovate configuration is complete here too, with no shared
  preset.
- The parts shared with the other repositories are duplicated on purpose; a change to them is repeated
  in each repository through its own pull request.

## Commands and quality gates

The scripts below are this repository's contract. While the repository is being bootstrapped,
create them with these exact names; afterwards, use them and never an ad-hoc equivalent. Run the
narrowest check that covers the change first, then widen:

| Changed                         | Minimum check                                                |
| ------------------------------- | ------------------------------------------------------------ |
| Domain or use case code         | `pnpm test <module>`, then `pnpm test:coverage`              |
| Persistence, events, migrations | `pnpm test:integration <module>`                             |
| Routes                          | `pnpm test <module>/api` and the contract tests              |
| Any source                      | `pnpm format:check`, `pnpm lint`, `pnpm typecheck`           |
| Build or runtime configuration  | `pnpm build`, `docker compose -f compose.dev.yaml config -q` |
| Docs or agent instructions only | Scoped formatting and link review                            |

Report the commands you actually ran and their results; a check you did not run is reported as not
run.

## Git and branch flow

- Trunk-based: work branches come from `main`, named `<type>/<lowercase-kebab-description>` with a
  type among `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`,
  `revert`; put the Waypoint task id first when there is one (`feat/way-482-sso-screen`). Never an
  agent name as a prefix. Validate with `git check-ref-format --branch <name>`.
- Commits and PR titles follow Conventional Commits: `type(scope): subject`, English, imperative,
  lowercase subject, no trailing period, at most 100 characters; `!` only for a breaking change.
- Pull requests target `main` and are squash-merged after review and green CI. release-please opens the release pull request; its merge tags the version, publishes the image to GHCR, and the deploy workflow of this repository (`.github/workflows/deploy.yml`) writes the new version into waypoint-ops (staging, then production after approval).
- Stage only the files of your task; preserve other people's changes in the working tree.

## Hard limits (never without the user's explicit request in this conversation)

- Never push to `main`, merge into it locally, create or push Git tags, or bump a version by hand.
- Never run a registry publish (`npm publish`, `pnpm publish`): this repository ships as a Docker image built by CI.
- Never force-push, and never amend or rebase commits that are already pushed.
- Never bypass the Git hooks (`--no-verify`, `core.hooksPath` overrides, `ALLOW_MAIN_PUSH=1`,
  `WP_SKIP_PUSH_CHECKS=1`).
- Never write a token, password or private key anywhere; `.npmrc` keeps `${NODE_AUTH_TOKEN}`. Do
  not read or write secret environment files; new variables are documented in `.env.example`.
- Never edit generated trees (`dist/`, `node_modules/`, `coverage/`, generated clients) or lockfiles by hand.
- Never modify a sibling checkout (`../waypoint-*`) from a task in this repository.
- Never write into another service's database, even for a "quick fix".
- Never edit a merged migration.

The agent hooks enforce most of these mechanically; a refused command is a signal to stop and ask,
not to find another way around it.

## Agent tooling

- **Claude Code**: [CLAUDE.md](CLAUDE.md) and [.claude/README.md](.claude/README.md): the
  `wp-identity-*` agents, the `/wp-*` commands (`/wp-quality` runs the whole local gate),
  path-scoped rules and hooks.
- **Codex**: [.codex/README.md](.codex/README.md) covers the specialists, `$wp-*` skills, rules and hooks.
- **Builders** (assigned writes): `wp-identity-module-builder`, `wp-identity-domain-builder`, `wp-identity-usecase-builder`, `wp-identity-endpoint-builder`, `wp-identity-event-builder`, `wp-identity-persistence-builder`, `wp-identity-migration-builder`, `wp-identity-test-writer`, `wp-identity-deploy-maintainer`, `wp-identity-github-maintainer`.
- **Reviewers** (read-only): `wp-identity-module-explorer`, `wp-identity-architecture-reviewer`, `wp-identity-contract-reviewer`, `wp-identity-security-auditor`, `wp-identity-observability-reviewer`, `wp-identity-performance-reviewer`.
- Specialists are available, not mandatory. Delegate a bounded responsibility with explicit files and
  checks, assign disjoint files to parallel agents and integrate their results yourself.

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
