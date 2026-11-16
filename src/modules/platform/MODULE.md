# Platform

## Purpose

Gives the tables of the service kit their place in this service's own migrations. drizzle-kit reads
`src/modules/*/infrastructure/persistence/drizzle/schemas/*/*.schema.ts` only. A kit table enters the migration history through a schema re-export in this module. It owns:

- `outbox_events`, `processed_events` and `event_versions`, defined by
  `@cadenway/nest-messaging/outbox/schema`;
- `idempotency_keys`, defined by `@cadenway/nest-common/database`.

It holds no business rule, no use case, no route and no handler, and never will: product data and
its rules belong to the business modules. The definition and the behavior of the tables belong to
the kit, through `DatabaseModule`, `MessagingModule` and `OutboxModule` registered in
`src/app.module.ts`.

## Public entry points

None. No module imports this one: the kit reads and writes the tables by name, through the
transaction runners.

## Owned tables

| Table              | Defined by                               | Organization scoping                                                         |
| ------------------ | ---------------------------------------- | ---------------------------------------------------------------------------- |
| `outbox_events`    | `@cadenway/nest-messaging/outbox/schema` | `organization_id`, null for an event outside any organization; policy forced |
| `processed_events` | `@cadenway/nest-messaging/outbox/schema` | None: consumer and event id only, no organization data, no policy            |
| `event_versions`   | `@cadenway/nest-messaging/outbox/schema` | `organization_id`, part of the unique key; policy forced                     |
| `idempotency_keys` | `@cadenway/nest-common/database`         | `organization_id`, part of the unique key; policy forced                     |

Created by `migrations/0000_platform_tables.sql`, owned by the migrator role `identity_migrator`.
The application role `identity_app` reads and writes their rows and holds no DDL right on them.

## API

None. The `Idempotency-Key` interceptor of `DatabaseModule` (`idempotency: true`) stores the key and
the response of a route marked `@Idempotent()` in `idempotency_keys`; no route is marked yet.

## Events emitted

None of its own. The outbox relay of `OutboxModule` publishes the rows the use cases of the
accounts and sessions modules append with `OutboxWriter.append`, on the subject and stream each row
stores: `evt.<name>` in `EVENTS`, or `restricted.<name>` in `EVENTS_RESTRICTED` for the events of
`restrictedEvents`.

## Events consumed

None. `processed_events` and `event_versions` record what the handlers of the business modules
consumed, through the PostgreSQL deduplicator of `OutboxModule`; no handler exists yet.

## Invariants

- Platform tables follow the kit's shared schema. The additive migration
  `migrations/0003_outbox_leases.sql` prepares the table for outbox reservations while the
  deployed relay keeps selecting pending events.
- The migrator runs the kit's lease finalizer after Drizzle commits. It builds the expiry index
  concurrently and validates both checks. Keep the expanded schema during a rollback and
  recover expired leases before restoring the historic relay.
- Row-level security is enabled and forced on `outbox_events`, `event_versions` and
  `idempotency_keys`; `processed_events` has none.
- Only a migration, run by the migrator role, changes their structure.

## Transactions

None of its own. The rows are written inside the units of work of others: an outbox row in the
transaction of the use case that changes the data (tenant runner, or system runner for an event
without organization), a processed id and a version in the transaction of the handler, an
idempotency key in the transaction the interceptor opens for its route. The relay locks, publishes
and marks pending rows in system transactions, and purges sent rows after 7 days and processed ids
after 14. The statement that marks a restricted row sent (`EVENTS_RESTRICTED`, `restricted.`
subjects) also replaces its payload with a redacted envelope (`@cadenway/nest-messaging` 0.1.2), so
a single-use code does not stay readable in `outbox_events`, and such a row is never requeued.

## Decisions

- Named `platform` because it holds the plumbing every Cadenway backend shares, not one capability:
  `outbox` or `messaging` would leave out `idempotency_keys`, and `kit` would suggest that the code
  of the kit lives here, when only its tables do.
- drizzle-kit enables row-level security but does not force it: the `FORCE ROW LEVEL SECURITY`
  statements of the migration are written by hand, as the READMEs of both kit packages require. A
  kit version that changes a table is applied with `pnpm migration:generate` in a new migration,
  following the note of its changeset; a forced policy on a new tenant table is added by hand again.
- `tests/service-wiring.int-spec.ts` proves that `src/migrate.ts` applies the migration as the
  migrator role, that the policies are forced, that the application role reads and writes the rows
  of its organization only and runs no DDL, and that the relay runs against an empty outbox.
