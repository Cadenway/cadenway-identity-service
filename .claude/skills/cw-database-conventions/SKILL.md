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
  subject to the policies.
- Row-level security is the second barrier, not the first: a query still filters on
  `organization_id` explicitly (`rules/infrastructure.md`).

## Connections and timeouts

- A pool of 5 connections per service: twelve backends share one PostgreSQL, and pools of 10 would
  exceed its default of 100 connections.
- `statement_timeout`, `lock_timeout` and `idle_in_transaction_session_timeout` are set per role,
  not per query.

## Not there yet

No table exists yet. The two roles are created by cadenway-ops with the first table of a service;
the test proving that one organization cannot read another's rows, and the linting of migrations,
arrive with the first module. Until then these conventions are applied by review.
