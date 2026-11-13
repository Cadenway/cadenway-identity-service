---
name: cw-jobs
description: "How to run durable background work with @cadenway/nest-jobs (pg-boss in the service database): the job enqueued in the use case transaction, one key per occurrence, bounded retries, the dead-letter queue. Load it before scheduling, enqueueing or handling a job."
---

# Jobs

Durable background work runs on `pg-boss` through `@cadenway/nest-jobs`, in this service's own
database. `@nestjs/schedule`, BullMQ and in-process timers are not used: none of them survives a
restart, and ESLint refuses the first two.

## Enqueueing

1. The use case enqueues the job **inside its transaction**, next to the state change and the outbox
   record: all commit or none does.
2. One job per outgoing effect: one email, one webhook call. Its idempotency key is the id of the
   send.
3. A job that belongs to an occurrence (a reminder, a digest, a due-date alert) carries a unique key
   for that occurrence; enqueueing it twice is a no-op.

## Scheduled work

- The business table is the source of truth (`due_at`, `sent_at`), not the queue.
- A recurring job claims the due rows with `FOR UPDATE SKIP LOCKED` and enqueues one job per row, so
  a missed or doubled tick changes nothing.

## Handling

1. A handler calls a use case; the use case is idempotent on the job key.
2. Delivery is at least once and never lost. "Never twice" cannot be guaranteed over SMTP or HTTP:
   make a duplicate harmless rather than assuming it away.
3. Retries are bounded, with backoff. A job that exhausts them goes to the dead-letter queue;
   MODULE.md says what an operator does with it.

## Not for

- Events between services: they go through the outbox (`cw-outbox-and-events`).
- Work on another service's data: a job only touches this service's database.

## Not there yet

`@cadenway/nest-jobs` is the fourth package of cadenway-service-kit and is not published yet. Until
it is installed, no job is written: do not depend on `pg-boss` directly.
