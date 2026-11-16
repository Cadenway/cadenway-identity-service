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
- Events emitted by this service, from `asyncapi/identity-service.yaml`: `user.signed-up.v1`, `user.email-verified.v1`, `session.revoked.v1`, and `one-time-code.issued.v1`, restricted (listed in `RESTRICTED_EVENT_NAMES`, published on `restricted.` for notification-service only). Any other event starts in cadenway-api-contracts.
