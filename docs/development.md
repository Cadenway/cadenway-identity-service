# Development and verification

[Documentation index](README.md) · [Repository overview](../.github/README.md) · [Repository instructions](../AGENTS.md)

## Bootstrap status

The application under `src/` runs on `@cadenway/nest-common`: its configuration is validated at
start-up, it writes JSON log lines, starts OpenTelemetry before the application, requires the
internal token on every route but the health probes, and its readiness checks its PostgreSQL
database. No business code, route, event or migration exists yet; the target architecture in this
guide is what they must follow. NATS is not connected: `@cadenway/nest-messaging` is not published
yet, so `NATS_URL`, `NATS_USER` and `NATS_PASSWORD` are set but read by nothing.

The commands below are the documented workflow. Inspect the repository's actual manifests and files before running them, and report unavailable checks rather than inventing replacements. Run Git, pnpm, build, and test commands with this repository as the working directory, never from the parent workspace.

## Before making a change

- The `MODULE.md` of the module you touch, and `src/app.module.ts` for the module list.
- `@cadenway/contracts` (installed) and `../cadenway-api-contracts`: `openapi/internal/identity-service.yaml` and `asyncapi/identity-service.yaml`.
- The [repositories document](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N), section "cadenway-identity-service", and the data model of the [integration guide](https://claude.ai/artifact/CpJHVCiFfF9j3KbHQ2S1Et).
- The mockup screens this service serves: Main, Inscription, Mfa, Otp, MotDePasseOublie, Reinitialisation, Deconnexion; Compte › Profil, Sécurité, Préférences, Jetons d’API; Organisation › Sécurité et SSO.
- `package.json` for versions and scripts once the repository is bootstrapped. Do not restate
  versions elsewhere: a copy goes stale.

## Setup

Requirements: Node.js LTS and pnpm (versions in `package.json`), and Docker.

1. Clone this repository next to the other Cadenway repositories, flat, in one folder.
2. To run it with the rest of Cadenway, start the stack from `cadenway-ops`; it builds the sibling
   folders, this one included. Follow its `docs/development.md`:

   ```bash
   cd ../cadenway-ops/compose
   cp .env.example .env                        # once
   docker compose run --rm internal-token-keys # once: the key pairs of the internal token
   docker compose up -d
   ```

3. To work on this repository alone, against its own PostgreSQL and NATS:

   ```bash
   pnpm install
   cp .env.example .env                        # once
   docker compose -f compose.dev.yaml up -d
   pnpm start:dev                              # http://localhost:3010/health/ready
   ```

   `compose.dev.yaml` gives PostgreSQL the two roles of cadenway-ops: `identity_migrator` owns the
   database and runs the DDL, `identity_app` runs the service under row-level security. They are
   created on an empty volume; recreate an older one once with
   `docker compose -f compose.dev.yaml down --volumes`. When 5432 or 4222 is taken, start the stack
   with `DEV_POSTGRES_PORT` or `DEV_NATS_PORT` and change the URLs of `.env` to match.

`pnpm start:dev` loads `.env` and starts the process the way the image does, with the
OpenTelemetry loader and `dist/telemetry.js` before `dist/main.js`; the two commands carry the same
flags and change together.

## Configuration

Validated at start-up by `src/config/app-config.ts`: a missing or invalid variable stops the
process with a `ConfigError` that names it. `.env.example` holds a working local value for each;
[cadenway-ops](https://github.com/Cadenway/cadenway-ops) (`docs/service-environment.md`) says where
each value comes from on a server.

| Variable                                 | Read by               | Value                                                                |
| ---------------------------------------- | --------------------- | -------------------------------------------------------------------- |
| `PORT`                                   | The service           | `3010`                                                               |
| `NODE_ENV`, `LOG_LEVEL`, `LOG_PRETTY`    | The service           | `production`, `info` and `false` when unset                          |
| `DATABASE_URL`                           | The service           | Application role `identity_app`                                      |
| `MIGRATION_DATABASE_URL`                 | `src/migrate.ts` only | Migrator role `identity_migrator`; required once a migration exists  |
| `INTERNAL_TOKEN_AUDIENCE`                | The service           | `identity-service`                                                   |
| `INTERNAL_TOKEN_TRUSTED_ISSUERS`         | The service           | One line of JSON: the public keys of each backend allowed to call it |
| `OTEL_EXPORTER_OTLP_ENDPOINT`            | `src/telemetry.ts`    | OTLP over HTTP; unset, nothing leaves the process                    |
| `NATS_URL`, `NATS_USER`, `NATS_PASSWORD` | Nothing yet           | Read by `@cadenway/nest-messaging` once it is wired                  |

### Calling the service locally

Every route but `/health/*` requires an internal token. The key in `.env.example` is a placeholder
whose private half was discarded: the service starts, and every call answers 401. To call it, get a
key pair from cadenway-ops, never from this repository:

```bash
cd ../cadenway-ops/compose
docker compose run --rm internal-token-keys --print   # prints fresh pairs on the terminal only
```

Put the `API_GATEWAY_INTERNAL_TOKEN_PUBLIC_JWKS` value inside the array of
`INTERNAL_TOKEN_TRUSTED_ISSUERS` in `.env` (`{"api-gateway":[<value>]}`) and restart. Then sign a
token, valid 60 seconds, with the matching private key, from this repository's root:

```bash
PRIVATE_JWK='<API_GATEWAY_INTERNAL_TOKEN_PRIVATE_JWK>' node --input-type=module -e '
import { InternalTokenSigner } from "@cadenway/nest-common";
const signer = await InternalTokenSigner.create({
  issuer: "api-gateway",
  privateJwk: JSON.parse(process.env.PRIVATE_JWK),
});
console.log(await signer.sign("identity-service", {
  actor: { type: "user", id: "01938f6e-8a42-7d5b-b2c9-5e1f3a6d9c24" },
  organizationId: "01938f6e-6d1a-7c3e-9a51-2f0c4b8d7e10",
}));'
```

and send it as `Authorization: Bearer <token>`. Use a workstation key only: the keys of staging and
production stay in the secrets of cadenway-ops.

### Migrations

`pnpm migration:generate` writes the migrations from the `*.schema.ts` files of the modules.
`pnpm migration:run` builds and runs `dist/migrate.js`, the command the GitOps agent runs in a
one-off container before it starts a new version; it connects as the migrator role of
`MIGRATION_DATABASE_URL`. Without a generated migration it does nothing.

### Integration tests

`pnpm test:integration` needs Docker. `test/service-wiring.int-spec.ts` starts the PostgreSQL of
`compose.dev.yaml` as a throwaway Compose project on a free port (the data of the dev stack is never
touched), assembles the application as `main.ts` does and checks the health routes and the internal
token. It moves to the fixtures of `@cadenway/nest-testing` once that package exports them.

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

The following commands match the planned local gate. Run `/cw-quality` in Claude Code or
`$cw-quality` in Codex without arguments. Verify CI coverage once workflows exist.

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:architecture
pnpm test:coverage
pnpm test:integration                    # PostgreSQL and NATS in Docker
pnpm build
docker compose -f compose.dev.yaml config -q
```

## Collaboration and release

- Trunk-based: work branches come from `main`, named `<type>/<lowercase-kebab-description>` with a
  type among `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`,
  `revert`; put the Cadenway task id first when there is one (`feat/cad-482-sso-screen`). Never an
  agent name as a prefix. Validate with `git check-ref-format --branch <name>`.
- Commits and PR titles follow Conventional Commits: `type(scope): subject`, English, imperative,
  lowercase subject, no trailing period, at most 100 characters; `!` only for a breaking change.
- Pull requests target `main` and are squash-merged after review and green CI. release-please opens the release pull request; its merge tags the version, publishes the image to GHCR, and the deploy workflow of this repository (`.github/workflows/deploy.yml`) writes the new version into cadenway-ops (staging, then production after approval).
- Stage only the files of your task; preserve other people's changes in the working tree.

Keep credentials, private keys, decrypted environment files and Terraform state out of documentation and logs. Follow the hard limits in [AGENTS.md](../AGENTS.md); setup instructions do not authorize deployments or changes to real infrastructure.
