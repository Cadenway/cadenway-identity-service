# cadenway-identity-service documentation

Planned role: cadenway-identity-service owns who the user is and how they sign in. NestJS, its own PostgreSQL database (one database with a migrator role and an application role in the shared PostgreSQL of the VPS), events over NATS JetStream through `@cadenway/nest-messaging`, internal REST for the API gateway. Local port 3010.

## Current status

The NestJS application under `src/` runs on `@cadenway/nest-common` and `@cadenway/nest-messaging`: configuration validated once at start-up, JSON logs, OpenTelemetry preloaded, the internal token required on every route but the health probes, the NATS connection of the `identity` user with the outbox relay, and a readiness route that checks PostgreSQL and NATS. Two business modules implement the walking skeleton of the installed `@cadenway/contracts`: `accounts` (users, password credentials, one-time codes, the code throttle and the password lockout, with the seven authentication flows and the reading of a user) and `sessions` (opening, introspection and revocation of sessions). They emit `user.signed-up.v1`, `user.email-verified.v1`, `session.revoked.v1` and the restricted `one-time-code.issued.v1` through the outbox. No route requires an organization. MFA, single sign-on, password reset, API tokens, profile and preferences are not built yet; the target architecture in this guide is what they must follow.

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
