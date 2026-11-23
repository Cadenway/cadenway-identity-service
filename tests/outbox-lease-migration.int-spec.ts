import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { readMigrationFiles } from 'drizzle-orm/migrator';
import pg from 'pg';
import { expect, it, vi } from 'vitest';

const composeFile = fileURLToPath(new URL('../compose.dev.yaml', import.meta.url));
const project = `cadenway-identity-outbox-test-${String(process.pid)}`;

// PostgreSQL is the only container in this suite. It needs no service-discovery network.
const loopbackPostgres = `
services:
  postgres:
    network_mode: bridge
networks:
  default:
    external: true
    name: bridge
`;

function compose(...args: readonly string[]): string {
  return execFileSync(
    'docker',
    ['compose', '--project-name', project, '--file', composeFile, '--file', '-', ...args],
    {
      encoding: 'utf8',
      env: { ...process.env, DEV_POSTGRES_PORT: '0' },
      input: loopbackPostgres,
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
}

it('preserves the legacy outbox and resumes expiry index finalization after an upgrade', async () => {
  let owner: pg.Client | undefined;
  try {
    compose('up', '--detach', '--wait', '--wait-timeout', '60', 'postgres');
    const port = compose('port', 'postgres', '5432').trim().split(':').at(-1);
    if (!port) throw new Error('PostgreSQL has no test port.');
    const connectionString = `postgres://identity_migrator:identity_migrator@127.0.0.1:${port}/identity`;
    owner = new pg.Client(connectionString);
    await owner.connect();
    const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url));
    // Stop after 0010_account_deletion_attempt. A later migration must remain outside the legacy fixture.
    const migrations = readMigrationFiles({ migrationsFolder });
    const baseline = migrations.slice(0, 11);
    await owner.query('begin');
    await owner.query('create schema drizzle');
    await owner.query(`create table drizzle.__drizzle_migrations (
      id serial primary key, hash text not null, created_at bigint)`);
    for (const migration of baseline) {
      for (const statement of migration.sql) {
        await owner.query(statement);
      }
      await owner.query(
        'insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)',
        [migration.hash, migration.folderMillis],
      );
    }
    const eventId = randomUUID();
    await owner.query("set local app.system_access = 'on'");
    await owner.query(
      `insert into outbox_events (id, event_name, subject, stream, payload)
       values ($1, 'identity.wiring-probe.v1', 'evt.identity.wiring-probe.v1', 'EVENTS', '{}')`,
      [eventId],
    );
    await owner.query('commit');

    vi.stubEnv('MIGRATION_DATABASE_URL', connectionString);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await import('../src/migrate.js');
      await owner.query('drop index concurrently public.outbox_events_lease_expiry_index');
      vi.resetModules();
      await import('../src/migrate.js');
    } finally {
      log.mockRestore();
    }

    const finalization = await owner.query(`
      select (
        select count(*)::int from pg_constraint
         where conrelid = 'public.outbox_events'::regclass and convalidated
           and conname in ('outbox_events_status_check', 'outbox_events_lease_check')
      ) as checks, (
        select indisvalid and indisready from pg_index
         where indexrelid = to_regclass('public.outbox_events_lease_expiry_index')
      ) as usable
    `);
    expect(finalization.rows).toEqual([{ checks: 2, usable: true }]);
    expect(
      (await owner.query('select count(*)::int as applied from drizzle.__drizzle_migrations')).rows,
    ).toEqual([{ applied: migrations.length }]);

    await owner.query("set app.system_access = 'on'");
    const legacy = await owner.query(
      'select status, lease_token, lease_expires_at from outbox_events where id = $1',
      [eventId],
    );
    expect(legacy.rows).toEqual([{ status: 'pending', lease_token: null, lease_expires_at: null }]);
    await expect(
      owner.query("update outbox_events set status = 'leased' where id = $1", [eventId]),
    ).rejects.toMatchObject({ code: '23514', constraint: 'outbox_events_lease_check' });
    const sent = await owner.query(
      "update outbox_events set status = 'sent' where id = $1 returning status",
      [eventId],
    );
    expect(sent.rows).toEqual([{ status: 'sent' }]);
  } finally {
    vi.unstubAllEnvs();
    try {
      await owner?.end();
    } finally {
      compose('down', '--volumes', '--remove-orphans');
    }
  }
});
