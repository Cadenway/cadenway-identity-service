---
name: cw-database-conventions
description: "The PostgreSQL conventions every Cadenway service follows: table and column naming, the common columns, row-level security, enumerations, pool size and timeouts. Load it before writing a Drizzle schema, a migration or a query."
---

# Database conventions

One PostgreSQL database per service, reached with Drizzle over `pg`. The conventions below are the
same in the ten services. `cw-expand-contract-migrations` covers how a schema changes over time.

## Naming

- Tables are plural and snake_case (`api_tokens`); columns are snake_case (`created_at`).

## Common columns

- `id uuid` with `uuidv7()` as default: PostgreSQL 18 generates the id, never application code. A
  display key such as `CAD-482` is a separate column.
- `organization_id` on every tenant-owned table, and **first** in every index a tenant query uses.
- `version`: the version of the aggregate, incremented by each write. It is the `ETag` of the API
  and the `version` field of the events (`cw-outbox-and-events`).
- `created_at` and `updated_at`, both `timestamptz`. Never a `timestamp` without time zone.

## Enumerations

- `text` with a `CHECK` constraint, never a PostgreSQL `enum` type: a new value is then an ordinary
  expand/contract migration.

## Row-level security

- Every table with an `organization_id` has row-level security **enabled and forced**, with a policy
  on `organization_id`.
- The transaction runner of the service kit issues `SET LOCAL app.organization_id` when a use case
  transaction starts. Never set it by hand; never open a connection around the runner.
- Two roles per service: `<svc>_migrator` runs the migrations, `<svc>_app` runs the service and is
  subject to the policies. The service connects with `DATABASE_URL` (`identity_app`);
  `src/migrate.ts` and drizzle-kit with `MIGRATION_DATABASE_URL` (`identity_migrator`). The
  application role reads and writes the tables and sequences of `public` only: the default
  privileges of the migrator are scoped to that schema, so it never reaches the `drizzle` schema of
  the migration journal.
- Row-level security is the second barrier, not the first: a query still filters on
  `organization_id` explicitly (`rules/infrastructure.md`).

## Connections and timeouts

- A pool of 5 connections per service: twelve backends share one PostgreSQL, and pools of 10 would
  exceed its default of 100 connections.
- `statement_timeout`, `lock_timeout` and `idle_in_transaction_session_timeout` are set per role,
  not per query.

## Tables of the service kit

The outbox, processed-ids and versions tables of `@cadenway/nest-messaging/outbox` and the
`idempotency_keys` table of `@cadenway/nest-common/database` live in this database too. They enter
the migrations by being re-exported from `src/modules/platform/infrastructure/persistence/` (the
platform module owns them and holds no business rule); their definition stays the kit's, so they
are exempt from the naming and common-column rules above. drizzle-kit enables row-level security
on a table that declares a policy but never forces it: every migration that creates a tenant table,
of a business module or of the kit, adds `ALTER TABLE "<table>" FORCE ROW LEVEL SECURITY;` by hand,
as `migrations/0000_platform_tables.sql` does.

## Not there yet

No business table exists yet. The two roles exist in cadenway-ops (`docs/database.md` there) and in
`compose.dev.yaml`; `test/service-wiring.int-spec.ts` proves on the kit tables that the policies are
forced, that one organization cannot read or write another's rows, and that the application role
runs no DDL and cannot touch the migration journal. The same test for each business table, and the
linting of migrations, arrive with the first business module. Until then these conventions are
applied by review.
