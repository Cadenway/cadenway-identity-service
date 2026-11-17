# Development and verification

[Documentation index](README.md) · [Repository overview](../.github/README.md) · [Repository instructions](../AGENTS.md)

## Bootstrap status

The application under `src/` runs on `@cadenway/nest-common` and `@cadenway/nest-messaging`: its
configuration is validated once, in `main.ts`, and handed to the application; a failed start-up is
one JSON line on the standard error; it writes JSON log lines, starts OpenTelemetry before the
application, requires the internal token on every route but the health probes, connects to NATS as
the `identity` user, runs the outbox relay, and its readiness checks PostgreSQL and NATS. The first
migration creates the tables of the service kit, owned by the platform module
(`src/modules/platform/MODULE.md`); the next ones, the tables of the accounts, sessions,
memberships and api-tokens modules, which serve every route of
`openapi/internal/identity-service.yaml`, emit the five events of `asyncapi/identity-service.yaml`
and consume the three member events of `asyncapi/organization-service.yaml` (their `MODULE.md`
files). The target architecture in this guide is what the next modules must follow.

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
   docker compose -f compose.dev.yaml up -d --wait
   pnpm migration:run                          # as identity_migrator; again after a pull that adds one
   pnpm start:dev                              # http://localhost:3010/health/ready
   ```

   `compose.dev.yaml` gives PostgreSQL the two roles of cadenway-ops: `identity_migrator` owns the
   database and runs the DDL, `identity_app` runs the service under row-level security, with rights
   on the rows of `public` only (never on the `drizzle` schema of the migration journal). They are
   created on an empty volume; recreate an older one once with
   `docker compose -f compose.dev.yaml down --volumes`. When 5432 or 4222 is taken, start the stack
   with `DEV_POSTGRES_PORT` or `DEV_NATS_PORT` and change the URLs of `.env` to match.

   Its NATS has the authorization of the broker of cadenway-ops (`docs/messaging.md` there): a
   connection without a user is refused, and the `identity` user may publish the subjects of the
   entities this service owns, subscribe to `_INBOX.identity.>` and `rebuild.identity.>` only, and
   use its three durable consumers of the member events only, each by its exact name and filter. A
   new or renamed handler fails at start-up until its four subjects are granted, here and in
   `compose/nats/nats-server.conf` of cadenway-ops first (`docs/messaging.md#adding-a-consumer`
   there).
   `nats-streams` runs the stream script of cadenway-ops with the `admin` user: it creates
   `EVENTS`, `EVENTS_RESTRICTED` and `EVENTS_DLQ` once NATS is healthy, checks them every minute
   and is healthy while they exist. The service never creates a stream and refuses to start
   without `EVENTS`. To look at the streams:
   `docker compose -f compose.dev.yaml exec nats-streams nats stream ls`.

`pnpm start:dev` loads `.env` and starts the process the way the image does:
`node --max-old-space-size=160 --import @cadenway/nest-common/register --import ./dist/telemetry.js`
before `dist/main.js`. The register entry point installs the OpenTelemetry module hooks without an
`ExperimentalWarning`, `telemetry.js` starts the SDK, and the heap cap keeps the old generation at
about 60 % of the 256M of the container. The two commands carry the same flags and change together.

## Configuration

Validated at start-up against the schema of `src/config/app-config.ts`, inside `runApplication`: a
missing or invalid variable stops the process with one JSON line whose `issues` name it, never its
value. `.env.example` holds a working local value for each;
[cadenway-ops](https://github.com/Cadenway/cadenway-ops) (`docs/service-environment.md`) says where
each value comes from on a server.

| Variable                              | Read by               | Value                                                                                                                                                         |
| ------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                                | The service           | `3010`                                                                                                                                                        |
| `NODE_ENV`, `LOG_LEVEL`, `LOG_PRETTY` | The service           | `production`, `info` and `false` when unset                                                                                                                   |
| `DATABASE_URL`                        | The service           | Application role `identity_app`                                                                                                                               |
| `MIGRATION_DATABASE_URL`              | `src/migrate.ts` only | Migrator role `identity_migrator`; required once a migration exists. The GitOps agent passes it to the migration container only, never to the running service |
| `INTERNAL_TOKEN_AUDIENCE`             | The service           | `identity-service`                                                                                                                                            |
| `INTERNAL_TOKEN_TRUSTED_ISSUERS`      | The service           | One line of JSON: the public keys of each backend allowed to call it                                                                                          |
| `OTEL_EXPORTER_OTLP_ENDPOINT`         | `src/telemetry.ts`    | OTLP over HTTP; unset, nothing leaves the process                                                                                                             |
| `NATS_URL`                            | The service           | `nats://` URL of the broker                                                                                                                                   |
| `NATS_USER`, `NATS_PASSWORD`          | The service           | User `identity` and its password; inbox prefix `_INBOX.identity`                                                                                              |
| `PASSWORD_PEPPER`                     | The service           | Secret of 32 characters at least, mixed into password and code hashes                                                                                         |

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
  actor: { type: "anonymous", id: null },
  organizationId: null,
}));'
```

and send it as `Authorization: Bearer <token>`. Each route accepts the issuer `api-gateway` only,
and one kind of actor: `anonymous` (above) for the authentication flows, `system` for
`POST /internal/v1/tokens/introspect` and `POST /internal/v1/api-tokens/introspect`, and `user`
(`{ type: "user", id: "<user id>" }`) for the routes of a session and of a user. Only the routes of
the personal API tokens need an organization (`organizationId: "<organization id>"`); a membership
reaches the copy of this service from `member.joined.v1`, which a workstation publishes with the
`admin` user: `docker compose -f compose.dev.yaml exec nats-streams nats pub --jetstream evt.member.joined.v1 '<payload>'`. The codes of a sign-up go to notification-service through `EVENTS_RESTRICTED`; alone,
on a workstation only, read the latest from the stream with the `admin` user:
`docker compose -f compose.dev.yaml exec nats-streams nats stream get EVENTS_RESTRICTED --last-for restricted.one-time-code.issued.v1`.
The outbox row no longer holds it once the relay published it. Use a workstation key only: the keys of staging and
production stay in the secrets of cadenway-ops.

### Migrations

`pnpm migration:generate` writes the migrations from the `*.schema.ts` files of the modules
(`pnpm migration:generate --name <what_it_does>` names the file). drizzle-kit enables row-level
security on a table with a policy but never forces it: add
`ALTER TABLE "<table>" FORCE ROW LEVEL SECURITY;` to the generated file for every new tenant table
before it is merged, then never edit it again. `pnpm migration:run` builds and runs
`dist/migrate.js`, the command the GitOps agent runs in a one-off container before it starts a new
version; it connects as the migrator role of `MIGRATION_DATABASE_URL` and applies what the journal
does not list yet.

The tables of the service kit reach the migrations through the platform module: the outbox,
processed-ids and versions tables of `@cadenway/nest-messaging/outbox` and `idempotency_keys` of
`@cadenway/nest-common/database` are re-exported from
`src/modules/platform/infrastructure/persistence/`. A kit version that changes one ships a note
in its changeset: upgrade the package, generate, review the new migration.

### Integration tests

`pnpm test:integration` needs Docker. `tests/service-wiring.int-spec.ts` starts PostgreSQL, NATS
and `nats-streams` from `compose.dev.yaml` as a throwaway Compose project on free ports (the data
of the dev stack is never touched), applies the migrations with `src/migrate.ts` as the migrator
role, and assembles the application as `main.ts` does, as `identity_app` and the NATS user
`identity`. It checks the ownership and forced row-level security of the kit tables, that the
application role reads and writes the rows of its organization only, runs no DDL and cannot touch
the migration journal of the `drizzle` schema, that the relay runs against an empty outbox, that
the broker enforces the permissions of cadenway-ops, the health routes (readiness 503 while NATS or
PostgreSQL is down and from the start of a shutdown, back to 200 once NATS returns) and the
internal token. `tests/auth-flows.int-spec.ts` starts its own throwaway project and calls every
route of `openapi/internal/identity-service.yaml` as the API gateway would, for each success and
error code of the contract; it checks that the outbox publishes the four events, the code on
`restricted.` only, that a revoked or idle session introspects as inactive, and that no log line
holds a password, a code, a token or the pepper. `tests/membership-redelivery.int-spec.ts` builds
`AppModule` with the redelivery schedule of the member event consumers shortened to a fraction of a
second, and checks that existing durable consumers are updated in place to its delivery limit, the
delay before each redelivery of a failing event, a pending event carried past the previous limit,
an event given up after its last delivery, and that the broker refuses a consumer it does not
grant. They move to the fixtures of `@cadenway/nest-testing` once that package exports
them.

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
