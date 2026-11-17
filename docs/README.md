# cadenway-identity-service documentation

Planned role: cadenway-identity-service owns who the user is and how they sign in. NestJS, its own PostgreSQL database (one database with a migrator role and an application role in the shared PostgreSQL of the VPS), events over NATS JetStream through `@cadenway/nest-messaging`, internal REST for the API gateway. Local port 3010.

## Current status

The NestJS application under `src/` runs on `@cadenway/nest-common` and `@cadenway/nest-messaging`: configuration validated once at start-up, JSON logs, OpenTelemetry preloaded, the internal token required on every route but the health probes, the NATS connection of the `identity` user with the outbox relay, and a readiness route that checks PostgreSQL and NATS. Four business modules implement the routes and events of the installed `@cadenway/contracts`: `accounts` (users, password credentials, one-time codes, reset links, pending changes of address, the throttles and the password lockout, with the seven authentication flows, the reading of a user and the update of its profile, the change and the reset of the password, the re-authentication, the change of address, and the scheduling, the cancellation and the completion of the deletion of an account by a durable job of `@cadenway/nest-jobs`), `sessions` (opening, introspection, list, revocation of sessions, their recent authentication, "Nouvelle connexion" and the choice of their current organization), `memberships` (the copy of the memberships of organization-service, fed by the member events) and `api-tokens` (personal API tokens and their introspection). They emit the events of `asyncapi/identity-service.yaml` (the restricted `one-time-code.issued.v1` and `password-reset-link.issued.v1` included) through the outbox, and consume `member.joined.v1`, `member.role-changed.v1` and `member.removed.v1`. Only the routes of the API tokens require an organization. MFA, single sign-on and preferences are not built yet; the target architecture in this guide is what they must follow.

## Read the guides

- [Architecture and ownership](architecture.md): boundaries and planned repository structure.
- [Development and checks](development.md): prerequisites, planned commands and verification.
- [Domain and integration](integration.md): repository-specific contracts, behavior and dependencies.

## Sources and policy

- [Repository overview](../.github/README.md) and [contribution guide](../.github/CONTRIBUTING.md).
- [Repository instructions and hard limits](../AGENTS.md).
- [Claude Code instructions](../CLAUDE.md) and [tooling](../.claude/README.md).
- [Codex tooling](../.codex/README.md).
- [Interactive mockup](https://claude.ai/artifact/KYRM7AnsYLiBLBLKy8i4HE), [integration guide](https://claude.ai/artifact/CpJHVCiFfF9j3KbHQ2S1Et), and [repositories and packages](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N).

Repository instructions take precedence over this summary. Refer to the actual package manifests, implementation, specifications, and workflows once they exist; do not infer a deployed feature from a target design.
