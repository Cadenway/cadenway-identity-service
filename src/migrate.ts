import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loadConfig } from '@cadenway/nest-common';
import { provisionJobs } from '@cadenway/nest-jobs/provisioning';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

import { migrationConfigSchema } from './config/app-config.js';
import type { MigrationConfig } from './config/app-config.js';
import { jobQueues } from './config/job-queues.js';

// Entry point of the one-off migration container (`node dist/migrate.js`), which the GitOps agent of
// cadenway-ops runs before it starts a new version. drizzle-kit is a development dependency and is
// not in the production image, so the migrations are applied with the runtime migrator.
//
// They run as the migrator role of MIGRATION_DATABASE_URL, which owns the tables: the application
// role of DATABASE_URL holds no DDL right and would be refused. The variable is validated only when
// there is something to apply, and a missing or malformed one stops the container with a
// ConfigError that names it.
//
// Then `provisionJobs` of @cadenway/nest-jobs installs or migrates the pg-boss schema (`pgboss`),
// creates or updates the queues of src/config/job-queues.ts and their dead-letter queues, and
// grants the application role its runtime access to them, which holds no DDL either. It is
// idempotent, like the migrations: the container runs both on every deployment.
/**
 * Constant migrationsFolder
 *
 * @description
 * Location of the migration files included in the service image.
 *
 * @type {string}
 */
const migrationsFolder: string = fileURLToPath(new URL('../migrations', import.meta.url));

/**
 * Constant APP_ROLE
 *
 * @description
 * The application role of this service's database, `identity_app` in every environment of
 * cadenway-ops (`docs/database.md` there) and in `compose.dev.yaml`: the role `provisionJobs`
 * grants the runtime access of the pg-boss schema to.
 *
 * @type {string}
 */
const APP_ROLE: string = 'identity_app';

if (!existsSync(`${migrationsFolder}/meta/_journal.json`)) {
  console.log('No migration has been generated yet: nothing to apply.');
} else {
  const migration: Readonly<MigrationConfig> = loadConfig(migrationConfigSchema);
  const pool: pg.Pool = new pg.Pool({
    connectionString: migration.MIGRATION_DATABASE_URL,
    application_name: 'identity-service-migrator',
  });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder });
    console.log('Migrations applied.');
  } finally {
    await pool.end();
  }
  await provisionJobs({
    connection: { connectionString: migration.MIGRATION_DATABASE_URL },
    appRole: APP_ROLE,
    queues: jobQueues,
  });
  console.log('Job queues provisioned.');
}
