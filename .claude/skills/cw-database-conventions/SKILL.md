---
name: cw-database-conventions
description: "The PostgreSQL conventions every Cadenway service follows: table and column naming, the common columns, row-level security, enumerations, pool size and timeouts. Load it before writing a Drizzle schema, a migration or a query."
---

# Database conventions

One PostgreSQL database per service, reached with Drizzle over `pg`. The conventions below are the
same in the ten services. `cw-expand-contract-migrations` covers how a schema changes over time.

Tenant reads must filter on the organization explicitly. Keep row-level security enabled and
forced, and use the kit's transaction runner. Load the relevant sections only:

- Schema or migration: [naming](references/database.md#naming),
  [common columns](references/database.md#common-columns),
  [enumerations](references/database.md#enumerations) and
  [row-level security](references/database.md#row-level-security).
- Tenant queries and transactions: [tenant indexes](references/database.md#common-columns) and
  [row-level security and roles](references/database.md#row-level-security).
- Connection settings or shared tables:
  [pool and timeouts](references/database.md#connections-and-timeouts) and
  [service-kit tables](references/database.md#tables-of-the-service-kit).
- Plan verification against the [current schema and test coverage](references/database.md#schema-and-test-coverage).
- System transactions: [exceptions to tenant conventions](references/database.md#tables-without-an-organization-and-the-system-runner).
