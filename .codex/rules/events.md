---
paths:
  - 'src/**/*.events.ts'
  - 'src/**/*.handler.ts'
  - 'src/**/*.publisher.ts'
  - 'src/**/events/**'
---

# Events

- Event names: `<entity>.<past-tense-fact>.v<version>`; the payload is the AsyncAPI schema of the
  installed `@waypoint/contracts`.
- Publish only through the outbox of `@waypoint/nest-messaging`, in the use case transaction. Never a
  direct NATS client.
- Handlers deduplicate on the event id and call a use case; they never write another service's data.
- A shape change is a new version; the old one keeps being emitted until every consumer moved.
- Events emitted by this service: `user.signed-up`, `user.email-verified`, `user.status-changed`, `session.revoked`, `api-token.created`, `api-token.revoked`.
