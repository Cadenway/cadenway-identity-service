---
name: cw-outbox-and-events
description: "How to publish and consume events reliably with @cadenway/nest-messaging: outbox in the use case transaction, idempotent handlers, retries, dead letters, versioned names. Load it whenever an event is published or handled."
---

# Outbox and events

## Publishing

1. The use case records the event with `outbox.record(event)` inside its transaction.
2. The outbox relay of `@cadenway/nest-messaging` publishes it to NATS JetStream after commit, with
   the trace id in its metadata.
3. Never publish directly: a crash between commit and publish would lose the event.

## Consuming

1. Declare the handler with the messaging decorator for the exact versioned name.
2. Deduplicate on `event.id` (the kit stores processed ids).
3. Call a use case; the use case is idempotent.
4. On failure the message is retried with backoff, then parked in the dead-letter stream; document
   in MODULE.md what an operator does with it.

## Changing an event

- Additive field: minor change in cadenway-api-contracts; consumers ignore unknown fields.
- Any other change: a new name `.v2`, emitted alongside `.v1` until every consumer moved.

## Version and order

- Every event carries `version`, the version of the aggregate after the change, and `actor`
  (`{ type: 'user' | 'automation' | 'git' | 'system', id }`).
- Delivery is at least once and order is not guaranteed across redeliveries: a handler ignores an
  event whose `version` it has already applied to that aggregate.
- Never derive order from arrival time.

## What the kit owns

Subjects (`evt.<name>`), the `EVENTS` stream, durable pull consumers (`<service>__<handler>`),
`Nats-Msg-Id` deduplication, the retry schedule, the copy of exhausted messages to `EVENTS_DLQ` and
`traceparent` propagation belong to `@cadenway/nest-messaging`. They are specified in
cadenway-service-kit (`cw-outbox-design` skill, `rules/messaging.md`); never declare a stream, a
consumer or a subject here.

## Rebuilding a consumer

Outbox rows are kept 7 days. A consumer that fell further behind is rebuilt: the owning service
re-emits the current state of its entities on `rebuild.<consumer>.<entity>`. A service that emits
events documents that use case in MODULE.md.
