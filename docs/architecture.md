# Architecture and ownership

[Documentation index](README.md) · [Repository instructions](../AGENTS.md)

## Status

The checkout contains the wiring of the service onto `@cadenway/nest-common`, and no business module yet:

| File                       | Role                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `src/telemetry.ts`         | Preloaded before the application: starts OpenTelemetry                                     |
| `src/main.ts`              | `createApplication` with the internal token verifier, then `listen`                        |
| `src/app.module.ts`        | The database pool and transaction runners, the health routes with the PostgreSQL indicator |
| `src/config/app-config.ts` | The zod schemas of the service and of the migrator                                         |
| `src/config/config.ts`     | The configuration of the running service, validated once                                   |
| `src/migrate.ts`           | The one-off migrator, run as the migrator role                                             |

Business modules will follow the structure below as their capabilities are implemented, each registered in `src/app.module.ts`.

## Purpose and target structure

cadenway-identity-service owns who the user is and how they sign in. NestJS, its own PostgreSQL database (one database with a migrator role and an application role in the shared PostgreSQL of the VPS), events over NATS JetStream through `@cadenway/nest-messaging`, internal REST for the API gateway. Local port 3010.

|            |                                                                                                                                                                                                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Data       | Users, hashed passwords, MFA factors (authenticator app, security keys, recovery codes), linked accounts (Google, GitHub, Microsoft, GitLab), SAML SSO connections per organization, sessions, personal API tokens, one-time codes and links, profile and preferences (theme, language, density, personal status). |
| API        | Sign-in, sign-up, MFA, one-time codes, password reset, sessions (list, revoke), API tokens, profile, preferences. Issues the tokens the gateways verify.                                                                                                                                                           |
| Emits      | `user.signed-up`, `user.email-verified`, `user.status-changed`, `session.revoked`, `api-token.created`, `api-token.revoked`                                                                                                                                                                                        |
| Listens to | `member.removed` (closes the user's sessions in that organization)                                                                                                                                                                                                                                                 |
| External   | OAuth providers, customers' SAML identity providers, WebAuthn for security keys.                                                                                                                                                                                                                                   |
| Phase      | First version                                                                                                                                                                                                                                                                                                      |

Decided: this service is built in NestJS, without an existing identity provider (Keycloak, Zitadel, Ory). Its security parameters are fixed in the `cw-identity-security` skill. Organizations and members belong to cadenway-organization-service from the start.

## Architectural ownership

Follow the [Cadenway NestJS architecture reference](https://github.com/Cadenway/cadenway-service-kit/blob/main/docs/hexagonal-architecture.md) for module structure, dependency direction, naming and test placement.

- Business code lives in modules under `src/modules/<module>/`, each with `domain/`, `application/`, `infrastructure/`, `api/` and a `MODULE.md`.
- Cross-cutting plumbing (config, logging, tracing, errors, auth guards, messaging) comes from the cadenway-service-kit packages (`@cadenway/nest-common`, `@cadenway/nest-messaging`); development-only `@cadenway/nest-testing` is maintained in [cadenway-tooling](https://github.com/Cadenway/cadenway-tooling).
- The domain is pure; use cases own transactions; controllers and handlers translate.
- Rendering of anything user-facing belongs to the webapp; this service returns data and stable error codes.

## Boundaries

- No access to another service's database or internal code; cross-service needs use `@cadenway/contracts` routes or events.
- NATS only through `@cadenway/nest-messaging`; config, logs, errors, health and auth guards through `@cadenway/nest-common`.
- Routes and event payloads come from the installed `@cadenway/contracts`; never redefine them locally.
- The service is internal: no Traefik label, no public route. Its HTTP callers are the API gateway and the realtime gateway (ticket redemption).
- No sibling sources imported, no `file:` or `link:` dependency on a sibling.

## Cross-repository changes

Each checkout owns its implementation and release. Use published `@cadenway/*` packages instead of sibling source imports or local dependency links. For contract changes, make the contract and generated package available first, then update the producing service, gateways and listeners, and finally the webapp. Each step should remain deployable independently.

## Architecture checks

`pnpm test:architecture` runs the service profile from [`@cadenway/nest-testing`](https://github.com/Cadenway/cadenway-tooling) against this repository's TypeScript configuration. It runs locally as part of `pnpm quality` and in the GitHub Actions quality gate.
