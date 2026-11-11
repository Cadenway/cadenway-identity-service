---
name: wp-outbox-and-events
description: "How to publish and consume events reliably with @waypoint/nest-messaging: outbox in the use case transaction, idempotent handlers, retries, dead letters, versioned names. Load it whenever an event is published or handled."
---

# Outbox and events

## Publishing

1. The use case records the event with `outbox.record(event)` inside its transaction.
2. The outbox relay of `@waypoint/nest-messaging` publishes it to NATS JetStream after commit, with
   the trace id in its metadata.
3. Never publish directly: a crash between commit and publish would lose the event.

## Consuming

1. Declare the handler with the messaging decorator for the exact versioned name.
2. Deduplicate on `event.id` (the kit stores processed ids).
3. Call a use case; the use case is idempotent.
4. On failure the message is retried with backoff, then parked in the dead-letter stream; document
   in MODULE.md what an operator does with it.

## Changing an event

- Additive field: minor change in waypoint-api-contracts; consumers ignore unknown fields.
- Any other change: a new name `.v2`, emitted alongside `.v1` until every consumer moved.
