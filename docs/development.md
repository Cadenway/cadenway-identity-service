# Development and verification

[Documentation index](README.md) · [Repository overview](../.github/README.md) · [Repository instructions](../AGENTS.md)

## Bootstrap status

At the time this documentation was written, this checkout has no `package.json`, application source tree, or GitHub workflow files. The target architecture, scripts, and workflows in this guide must be created and verified during bootstrap.

The commands below are the documented **target workflow**, copied from the repository overview and instructions. They are not proof that scripts, infrastructure, CI, or dependencies currently exist. Inspect the repository's actual manifests and files before running them, and report unavailable checks rather than inventing replacements. Run Git, pnpm, build, and test commands with this repository as the working directory, never from the parent workspace.

## Before making a change

- The `MODULE.md` of the module you touch, and `src/app.module.ts` for the module list.
- `@waypoint/contracts` (installed) and `../waypoint-api-contracts`: `openapi/internal/identity-service.yaml` and `asyncapi/identity-service.yaml`.
- The [repositories document](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N), section "waypoint-identity-service", and the data model of the [integration guide](https://claude.ai/artifact/CpJHVCiFfF9j3KbHQ2S1Et).
- The mockup screens this service serves: Main, Inscription, Mfa, Otp, MotDePasseOublie, Reinitialisation, Deconnexion; Compte › Profil, Sécurité, Préférences, Jetons d’API; Organisation › Sécurité et SSO.
- `package.json` for versions and scripts once the repository is bootstrapped. Do not restate
  versions elsewhere: a copy goes stale.

## Planned setup

Requirements: Node.js LTS and pnpm (versions in `package.json`), and Docker.

1. Clone this repository next to the other Waypoint repositories, flat, in one folder.
2. To run it with the rest of Waypoint, start the stack from `waypoint-ops`; it builds the sibling
   folders, this one included (`core` profile; `full` adds every other service):

   ```bash
   cd ../waypoint-ops/compose
   docker compose -f compose.yaml -f compose.local.yaml --profile core up -d
   ```

3. To work on this repository alone:

   ```bash
   pnpm install
   pnpm start:dev              # http://localhost:3010
   ```

## Minimum checks by change

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

## Planned full check list

The following commands match the planned local gate. Run `/wp-quality` in Claude Code or
`$wp-quality` in Codex without arguments. Verify CI coverage once workflows exist.

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm test:integration                    # PostgreSQL and NATS in Docker
pnpm build
docker compose -f compose.dev.yaml config -q
```

## Collaboration and release

- Trunk-based: work branches come from `main`, named `<type>/<lowercase-kebab-description>` with a
  type among `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`,
  `revert`; put the Waypoint task id first when there is one (`feat/way-482-sso-screen`). Never an
  agent name as a prefix. Validate with `git check-ref-format --branch <name>`.
- Commits and PR titles follow Conventional Commits: `type(scope): subject`, English, imperative,
  lowercase subject, no trailing period, at most 100 characters; `!` only for a breaking change.
- Pull requests target `main` and are squash-merged after review and green CI. release-please opens the release pull request; its merge tags the version, publishes the image to GHCR, and the deploy workflow of this repository (`.github/workflows/deploy.yml`) writes the new version into waypoint-ops (staging, then production after approval).
- Stage only the files of your task; preserve other people's changes in the working tree.

Keep credentials, private keys, decrypted environment files and Terraform state out of documentation and logs. Follow the hard limits in [AGENTS.md](../AGENTS.md); setup instructions do not authorize deployments or changes to real infrastructure.
