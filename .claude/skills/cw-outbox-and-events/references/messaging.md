# Outbox and events reference

## Publishing

1. The use case appends the event inside its own transaction, with the schemas of the contract
   (`eventSchemas` of `@cadenway/contracts/events/<spec>`) and the injected `OutboxWriter`.
   PostgreSQL assigns the event id (`uuidv7()`) and the instant; the payload is validated before
   the row is written:

   ```ts
   await this.outbox.append(tx, eventSchemas, 'session.revoked.v1', {
     organizationId: null,
     actor: { type: 'user', id: userId },
     version,
     sessionId,
   });
   ```
2. An event with an organization is appended in a tenant transaction of that organization; one
   without (`organizationId: null`) in a system transaction only: row-level security refuses it in
   a tenant one.
3. The relay publishes the row after the commit, on `evt.<event-name>` with `Nats-Msg-Id` set to the
   event id and the `traceparent` of the use case. `relay.wake()` after the commit publishes now
   instead of at the next poll (one second).
4. Never publish directly: a crash between commit and publish would lose the event. `EventPublisher`
   is for an application without a database (the API gateway).

## Consuming

1. Register the handler from `onApplicationBootstrap` of a provider under
   `presentation/messaging/handlers/<family>/` in V2 (`api/messaging/` before migration),
   with the `EventConsumers` of the kit. It gets the durable consumer `identity-service__<handler>`,
   filtered on the one subject of its event:

   ```ts
   await this.consumers.subscribe({
     handler: 'project-member-removed',
     schemas: eventSchemas,
     event: 'member.removed.v1',
     redelivery: this.redelivery,
     handle: (payload) => this.applyMembershipChange.execute(toChange('removed', payload)),
   });
   ```

   The `identity` NATS user may use a consumer only once cadenway-ops grants it by its exact name
   and filter (`compose/nats/nats-server.conf`, `docs/messaging.md#adding-a-consumer`): a new or
   renamed handler gets its grant there, deployed before the release that adds it, and the same
   four subjects in `compose.dev.yaml`; without it the service fails at start-up.
2. The deduplicator of `OutboxModule` records `(consumer, event id)` in `processed_events` in the
   handler's transaction (tenant runner for an event with an organization): a redelivery of a
   handled event is skipped. A `run` of the same runner inside the handler joins that transaction.
3. Call a use case; it is idempotent for anything outside the database (an e-mail, a call).
4. A rejection is retried after 1 s, 5 s, 30 s and 2 min by default; the fifth failure, or a
   payload that does not match its schema, becomes a dead letter in `EVENTS_DLQ`, copied by
   notification-service. A handler whose effects must not be given up after minutes, such as a
   security projection, sets its own `redelivery: { delaysMs, maxDeliveries }` (the member event
   consumers retry about 25 hours, see the memberships `MODULE.md`), and its release replaces every
   replica. Document in MODULE.md the schedule and what an operator does with a dead letter.
5. A handler with outside effects registers with `deliverPolicy: 'new'`; the default `all` delivers
   up to seven days of events to a new consumer.

## Changing an event

- Additive field: minor change in cadenway-api-contracts; consumers ignore unknown fields.
- Any other change: a new name `.v2`, emitted alongside `.v1` until every consumer moved.

## Version and order

- Every event carries `version`, the version of the aggregate after the change, and `actor`
  (`{ type: 'user' | 'automation' | 'git' | 'system', id }`).
- Delivery is at least once and order is not guaranteed: `claimVersion(aggregateKey)` in the handler
  context (a key such as `session:<id>`) resolves to `false` for a version already applied to that
  aggregate in that organization, by that consumer. An aggregate whose events travel on several
  subjects (the three member events of a membership) has as many consumers: order it by its stored
  `version` instead, as the memberships module does.
- Never derive order from arrival time.

## What the kit and the broker own

Subjects (`evt.<name>`), durable pull consumers (`<service>__<handler>`), `Nats-Msg-Id`
deduplication, the retry schedule, the dead-letter copy and `traceparent` propagation belong to
`@cadenway/nest-messaging`. The three streams (`EVENTS`, `EVENTS_RESTRICTED`, `EVENTS_DLQ`) and the
permissions of the `identity` user (publish `evt.user.>`, `evt.session.>`, `evt.api-token.>` and
`restricted.>`, subscribe `_INBOX.identity.>` and `rebuild.identity.>`) belong to cadenway-ops
(`docs/messaging.md`). This service runs with `manageStreams: false` and `deadLetterWorker: false`:
never declare a stream, a consumer or a subject here. An event of a new entity needs its
`evt.<entity>.>` in cadenway-ops first.

An identity event that carries a single-use code or link for a security e-mail is a restricted
event: listed in `restrictedEvents` of `MessagingModule`, it is published on `restricted.<name>`
into `EVENTS_RESTRICTED`, which notification-service alone reads. `src/app.module.ts` passes
`RESTRICTED_EVENT_NAMES` of `@cadenway/contracts/events/identity-service` (`one-time-code.issued.v1`
and `password-reset-link.issued.v1` today), never a list of its own; listing an event later does not
move the outbox rows already written. The outbox row of a restricted event holds its payload, the code included, until the relay
publishes it: since `@cadenway/nest-messaging` 0.1.2 the statement that marks the row sent replaces
the payload with a redacted envelope (`id`, `occurredAt`, `organizationId`, `actor`, `version`,
`"$redacted": true`). A redacted row is never requeued: a code lost with NATS is replaced by a new
request. A spec reads a code from its message in `EVENTS_RESTRICTED`, never from the outbox.

## Rebuilding a consumer

Outbox rows are kept 7 days. A consumer that fell further behind is rebuilt: the owning service
re-emits the current state of its entities with `RebuildEmitter` on `rebuild.<consumer>.<entity>`
(`rebuild.search.user`), unacknowledged, the only mode the permissions allow. A service that emits
events documents that use case in MODULE.md.
