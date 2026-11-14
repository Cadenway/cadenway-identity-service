import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

// Entry point of the one-off migration container (`node dist/migrate.js`): drizzle-kit is a
// development dependency and is not in the production image, so the migrations are applied with the
// runtime migrator against the database this service owns.
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
 * Constant databaseUrl
 *
 * @description
 * Connection string for the service's own database, if configured.
 *
 * @type {string | undefined}
 */
const databaseUrl: string | undefined = process.env.DATABASE_URL;

if (databaseUrl === undefined || databaseUrl === '') {
  throw new Error('DATABASE_URL is required to apply the migrations.');
}

if (!existsSync(`${migrationsFolder}/meta/_journal.json`)) {
  console.log('No migration has been generated yet: nothing to apply.');
} else {
  const pool: pg.Pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder });
    console.log('Migrations applied.');
  } finally {
    await pool.end();
  }
}
