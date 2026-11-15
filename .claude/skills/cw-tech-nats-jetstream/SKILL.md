---
name: cw-tech-nats-jetstream
description: "Implement or review NATS JetStream messaging, subscriptions, delivery, or event publication for Cadenway."
---

# Nats Jetstream for Cadenway

Start from the producing service's AsyncAPI contract and existing outbox/event rules. In consuming services and gateways, use the published `@cadenway/nest-messaging` package instead of direct NATS clients; the service kit owns its implementation, and ops owns broker deployment. Preserve event versioning, transactional outbox behavior, idempotency and redelivery handling. Run relevant contract and integration checks when available, and coordinate producer before consumers.

The service kit builds on the `@nats-io/transport-node` and `@nats-io/jetstream` packages. Subjects (`evt.<event-name>`), durable consumer names, retries by delayed negative acknowledgement and the dead-letter copy are fixed by the README of `@cadenway/nest-messaging` and the `cw-outbox-design` skill of cadenway-service-kit: do not choose them per service. The three streams (`EVENTS`, `EVENTS_RESTRICTED`, `EVENTS_DLQ`), the `identity` user and its permissions belong to cadenway-ops (`docs/messaging.md`); this service connects with `manageStreams: false`, and `compose.dev.yaml` reproduces that broker for local work and the integration test.

Consult the official documentation for the version actually used: https://docs.nats.io/concepts/jetstream.
