# Architecture and ownership

[Documentation index](README.md) · [Repository instructions](../AGENTS.md)

## Status

The checkout contains NestJS startup, health and configuration code. Business modules will follow the structure below as their capabilities are implemented.

## Purpose and target structure

cadenway-identity-service owns who the user is and how they sign in. NestJS, its own PostgreSQL database (one database and one user in the shared PostgreSQL of the VPS), events over NATS JetStream through `@cadenway/nest-messaging`, internal REST for the API gateway. Local port 3010.

|            |                                                                                                                                                                                                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Data       | Users, hashed passwords, MFA factors (authenticator app, security keys, recovery codes), linked accounts (Google, GitHub, Microsoft, GitLab), SAML SSO connections per organization, sessions, personal API tokens, one-time codes and links, profile and preferences (theme, language, density, personal status). |
| API        | Sign-in, sign-up, MFA, one-time codes, password reset, sessions (list, revoke), API tokens, profile, preferences. Issues the tokens the gateways verify.                                                                                                                                                           |
| Emits      | `user.signed-up`, `user.email-verified`, `user.status-changed`, `session.revoked`, `api-token.created`, `api-token.revoked`                                                                                                                                                                                        |
| Listens to | `member.removed` (closes the user's sessions in that organization)                                                                                                                                                                                                                                                 |
| External   | OAuth providers, customers' SAML identity providers, WebAuthn for security keys.                                                                                                                                                                                                                                   |
| Phase      | First version                                                                                                                                                                                                                                                                                                      |

Decided: this service is built in NestJS, without an existing identity provider (Keycloak, Zitadel, Ory). Its security parameters are fixed in the `cw-identity-security` skill. At start-up this service also carries the organizations and members module, extracted later into cadenway-organization-service.

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
- The service is internal: no Traefik label, no public route; the API gateway is its only HTTP caller.
- No sibling sources imported, no `file:` or `link:` dependency on a sibling.

## Cross-repository changes

Each checkout owns its implementation and release. Use published `@cadenway/*` packages instead of sibling source imports or local dependency links. For contract changes, make the contract and generated package available first, then update the producing service, gateways and listeners, and finally the webapp. Each step should remain deployable independently.

## Architecture checks

`pnpm test:architecture` runs the service profile against this repository's TypeScript configuration. It requires a published release of [`@cadenway/nest-testing`](https://github.com/Cadenway/cadenway-tooling) that exports `/architecture`. Once that release is available and this repository's GitHub Actions has package read access, update the development dependency and frozen lockfile and run the script as part of `pnpm quality` and pull request CI.
