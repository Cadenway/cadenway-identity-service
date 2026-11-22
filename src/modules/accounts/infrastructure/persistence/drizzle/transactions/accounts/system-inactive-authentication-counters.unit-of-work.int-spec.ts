import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { SystemTransactionRunner } from '@cadenway/nest-common/database';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EmailAddress } from '../../../../../domain/value-objects/email/email-address.value-object.js';
import { DrizzleSignInAttemptRepository } from '../../repositories/accounts/drizzle-sign-in-attempt.repository.js';
import { DrizzleCodeRequestRepository } from '../../repositories/authentication/drizzle-code-request.repository.js';
import { DrizzlePasswordResetRequestRepository } from '../../repositories/password-reset/drizzle-password-reset-request.repository.js';
import { SystemInactiveAuthenticationCountersUnitOfWork } from './system-inactive-authentication-counters.unit-of-work.js';

const composeFile = fileURLToPath(
  new URL('../../../../../../../../compose.dev.yaml', import.meta.url),
);
const migrations = fileURLToPath(new URL('../../../../../../../../migrations', import.meta.url));
const project = `identity-authentication-retention-${String(process.pid)}`;
const counterTables = ['code_requests', 'password_reset_requests', 'sign_in_attempts'];

function compose(...args: string[]): string {
  return execFileSync(
    'docker',
    ['compose', '--project-name', project, '--file', composeFile, ...args],
    {
      encoding: 'utf8',
      env: { ...process.env, DEV_POSTGRES_PORT: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
}

describe('authentication counter retention', () => {
  let pool: pg.Pool | undefined;
  let runner: SystemTransactionRunner;
  let sweep: SystemInactiveAuthenticationCountersUnitOfWork;

  beforeAll(async () => {
    compose('up', '--detach', '--wait', '--wait-timeout', '120', '--pull', 'never', 'postgres');
    const port = compose('port', 'postgres', '5432').trim().split(':').at(-1);
    if (port === undefined) throw new Error('PostgreSQL has no test port.');
    const migrator = new pg.Pool({
      connectionString: `postgres://identity_migrator:identity_migrator@127.0.0.1:${port}/identity`,
    });
    try {
      await migrate(drizzle({ client: migrator }), { migrationsFolder: migrations });
    } finally {
      await migrator.end();
    }
    pool = new pg.Pool({
      connectionString: `postgres://identity_app:identity_app@127.0.0.1:${port}/identity`,
    });
    runner = new SystemTransactionRunner(pool);
    sweep = new SystemInactiveAuthenticationCountersUnitOfWork(runner);
  });

  afterAll(async () => {
    try {
      await pool?.end();
    } finally {
      compose('down', '--volumes', '--remove-orphans');
    }
  });

  it('removes old rows in bounded batches and preserves current rows and live lockouts', async () => {
    const old = ['old-camille@ateliernord.fr', 'old-ines@ateliernord.fr'];
    const recent = 'recent@ateliernord.fr';
    const locked = 'locked@ateliernord.fr';

    await runner.run(async ({ client }) => {
      for (const table of counterTables) {
        await client.query(
          `insert into ${table} (email, updated_at)
           select email, now() - interval '25 hours' from unnest($1::text[]) as addresses(email)`,
          [old],
        );
        await client.query(`insert into ${table} (email) values ($1)`, [recent]);
      }
      await client.query(
        `insert into sign_in_attempts (email, failed_attempts, locked_until, updated_at)
         values ($1, 5, now() + interval '14 minutes', now() - interval '25 hours')`,
        [locked],
      );
    });

    expect(await sweep.deleteBatch(1)).toBe(3);
    expect(await sweep.deleteBatch(1)).toBe(3);
    expect(await sweep.deleteBatch(1)).toBe(0);
    await runner.run(async ({ client }) => {
      for (const table of counterTables) {
        const left = await client.query(`select email from ${table} order by email`);
        const kept = table === 'sign_in_attempts' ? [locked, recent] : [recent];
        expect(left.rows).toEqual(kept.map((email) => ({ email })));
      }
    });
  });

  it('skips a counter held by a request and lets later requests lock swept addresses again', async () => {
    const address = EmailAddress.of('expired@ateliernord.fr');
    await runner.run(async ({ client }) => {
      for (const table of counterTables) {
        await client.query(
          `insert into ${table} (email, updated_at) values ($1, now() - interval '25 hours')`,
          [address.value],
        );
      }
    });
    if (pool === undefined) throw new Error('The PostgreSQL fixture is not connected.');
    const request = await pool.connect();
    try {
      await request.query('begin');
      await request.query('select email from sign_in_attempts where email = $1 for update', [
        address.value,
      ]);
      expect(await sweep.deleteBatch(1)).toBe(2);
      expect(await sweep.deleteBatch(1)).toBe(0);
    } finally {
      await request.query('rollback');
      request.release();
    }
    expect(await sweep.deleteBatch(1)).toBe(1);
    await runner.run(async ({ db }) => {
      const attempt = await new DrizzleSignInAttemptRepository(db).lock(address);
      const code = await new DrizzleCodeRequestRepository(db).lock(address);
      const reset = await new DrizzlePasswordResetRequestRepository(db).lock(address);
      expect(attempt.snapshot.failedAttempts).toBe(0);
      expect(code.snapshot.windowRequests).toBe(0);
      expect(reset.snapshot.windowRequests).toBe(0);
    });
  });

  it('serializes the first password attempts for an address without a counter', async () => {
    const address = EmailAddress.of('first-attempt@ateliernord.fr');
    const failedCounts = await Promise.all(
      [1, 2].map(() =>
        runner.run(async ({ db }) => {
          const attempts = new DrizzleSignInAttemptRepository(db);
          const locked = await attempts.lock(address);
          const failure = locked.recordFailure(new Date());
          await attempts.save(address, failure.lockout);
          return failure.lockout.snapshot.failedAttempts;
        }),
      ),
    );
    expect(failedCounts.sort((left, right) => left - right)).toEqual([1, 2]);
  });
});
