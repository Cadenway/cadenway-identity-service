# cadenway-identity-service documentation

Planned role: cadenway-identity-service owns who the user is and how they sign in. NestJS, its own PostgreSQL database (one database with a migrator role and an application role in the shared PostgreSQL of the VPS), events over NATS JetStream through `@cadenway/nest-messaging`, internal REST for the API gateway. Local port 3010.

## Current status

The NestJS application under `src/` runs on `@cadenway/nest-common` and `@cadenway/nest-messaging`: configuration validated at start-up, JSON logs, OpenTelemetry preloaded, the internal token required on every route but the health probes, the NATS connection of the `identity` user with the outbox relay, and a readiness route that checks PostgreSQL and NATS. The only migration creates the tables of the service kit (outbox, processed ids, versions, `Idempotency-Key`), owned by the platform module. No business code, route or event exists yet; the target architecture in this guide is what they must follow.

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
