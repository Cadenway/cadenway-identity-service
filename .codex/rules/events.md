---
paths:
  - 'src/**/*.events.ts'
  - 'src/**/*.handler.ts'
  - 'src/**/*.publisher.ts'
  - 'src/**/events/**'
---

# Events

- In V2, place incoming handlers under `presentation/messaging/handlers/<family>/`; use the
  existing handler paths in modules awaiting migration.
- Event names: `<entity>.<past-tense-fact>.v<version>`; the payload is the AsyncAPI schema of the
  installed `@cadenway/contracts`.
- Publish only through the outbox of `@cadenway/nest-messaging`, in the use case transaction. Never a
  direct NATS client.
- Handlers deduplicate on the event id and call a use case; they never write another service's data.
- A shape change is a new version; the old one keeps being emitted until every consumer moved.
- Events emitted by this service, from `asyncapi/identity-service.yaml`: `user.signed-up.v1`, `user.email-verified.v1`, `user.profile-updated.v1`, `user.password-changed.v1`, `user.email-changed.v1`, `user.deletion-scheduled.v1`, `user.deletion-cancelled.v1`, `user.deleted.v1`, `user.two-step-verification-changed.v1`, `session.revoked.v1`, `session.opened-on-new-device.v1`, `session.organization-changed.v1`, and `one-time-code.issued.v1` and `password-reset-link.issued.v1`, restricted (listed in `RESTRICTED_EVENT_NAMES`, published on `restricted.` for notification-service only). Any other event starts in cadenway-api-contracts.
- Events consumed, from `asyncapi/organization-service.yaml`: `member.joined.v1`, `member.role-changed.v1` and `member.removed.v1`, by the memberships module, which applies a membership by its `version` and keeps a removed one removed (`claimVersion` keys versions per consumer and cannot order three subjects).

## Review example

For example, an integration test for a changed consumer can deliver the same event twice and
assert a single business effect. For a write that emits an event, exercise a failed outbox write
and verify that the domain data rolls back with it.
