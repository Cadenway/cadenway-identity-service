---
name: cw-outbox-and-events
description: "How to publish and consume events reliably with @cadenway/nest-messaging: outbox in the use case transaction, idempotent handlers, retries, dead letters, versioned names. Load it whenever an event is published or handled."
---

# Outbox and events

The wiring is in place (`src/app.module.ts`): `MessagingModule` connects as the NATS user
`identity`, `OutboxModule` provides the writer, the relay and the deduplicator, and the platform
module (`src/modules/platform`) brings their tables into the migrations. The README of
`@cadenway/nest-messaging` is the reference for every call below. The events of this service are
those of `asyncapi/identity-service.yaml` (`eventSchemas` of
`@cadenway/contracts/events/identity-service`): `user.signed-up.v1`, `user.email-verified.v1`,
`user.profile-updated.v1`, `user.password-changed.v1`, `user.email-changed.v1`,
`user.deletion-scheduled.v1`, `user.deletion-cancelled.v1`, `user.deleted.v1`, `session.revoked.v1`,
`session.opened-on-new-device.v1` and the restricted `one-time-code.issued.v1` and
`password-reset-link.issued.v1`, all with `organizationId: null`, appended by the outbox adapters of
the accounts and sessions modules.
The memberships module consumes `member.joined.v1`, `member.role-changed.v1` and
`member.removed.v1` of `@cadenway/contracts/events/organization-service`. Another event is published or
consumed only once its AsyncAPI spec is released (`cw-contract-first`).

- Publish through the outbox inside the use case transaction. Match the transaction runner to the
  event's tenant scope. The relay publishes after commit.
- Consume through the kit. Deduplicate in the handler transaction, apply aggregate versions
  independently of arrival order and make external effects idempotent.

Read only the sections that your change needs:

- Append an event or change its contract: [publishing](references/messaging.md#publishing),
  [changing an event](references/messaging.md#changing-an-event) and
  [version and order](references/messaging.md#version-and-order).
- Subscribe or change a handler: [consuming](references/messaging.md#consuming) and
  [version and order](references/messaging.md#version-and-order).
- Change runtime wiring, subjects or permissions:
  [kit and broker ownership](references/messaging.md#what-the-kit-and-the-broker-own).
- Recover a lagging consumer: [rebuild](references/messaging.md#rebuilding-a-consumer).
