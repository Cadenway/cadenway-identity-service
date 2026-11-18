import { execFileSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { createApplication, InternalTokenSigner, loadConfig } from '@cadenway/nest-common';
import type {
  Ed25519PrivateJwk,
  Ed25519PublicJwk,
  InternalTokenClaims,
} from '@cadenway/nest-common';
import { SystemTransactionRunner } from '@cadenway/nest-common/database';
import { JobProducer } from '@cadenway/nest-jobs/runtime';
import { OutboxRelay, OutboxWriter } from '@cadenway/nest-messaging/outbox';
import type { NestExpressApplication } from '@nestjs/platform-express';
import pg from 'pg';
import request from 'supertest';
import type { Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { appConfigSchema } from '../src/config/app-config.js';
import { SystemAccountsUnitOfWork } from '../src/modules/accounts/infrastructure/persistence/drizzle/transactions/accounts/system-accounts.unit-of-work.js';

// The profile of `PATCH /internal/v1/users/{userId}` (`PATCH /v1/me`) on the service as main.ts
// assembles it, against a disposable PostgreSQL and NATS started from compose.dev.yaml (see
// service-wiring.int-spec.ts): the merge patch, `If-Match`, the validation of the time zone, the
// `user.profile-updated.v1` it publishes, and the rollback of a failed change. The accounts are
// written by the migrator role, as verified accounts of the mockup.

/** Compose file of the development dependencies. */
const composeFile: string = fileURLToPath(new URL('../compose.dev.yaml', import.meta.url));

/** Throwaway project name, distinct from the other specs and from any developer stack. */
const project = `cadenway-identity-service-profile-test-${String(process.pid)}`;

/** Camille Martin (CM), of Atelier Nord. */
const camilleId = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';

/** Inès Robert, of Atelier Nord. */
const inesId = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b31';

/**
 * Runs `docker compose` on the throwaway project.
 *
 * @param args - Compose command and its arguments.
 * @returns The standard output.
 */
function compose(...args: readonly string[]): string {
  return execFileSync(
    'docker',
    ['compose', '--project-name', project, '--file', composeFile, ...args],
    {
      encoding: 'utf8',
      env: { ...process.env, DEV_POSTGRES_PORT: '0', DEV_NATS_PORT: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
}

/**
 * Reads the published host port of a service of the project.
 *
 * @param service - Compose service.
 * @param port - Port inside the container.
 * @returns The host port.
 */
function hostPort(service: string, port: string): string {
  return compose('port', service, port).trim().split(':').at(-1) ?? '';
}

/**
 * Reads the subjects a stream holds, with the `admin` user of the `nats-streams` container.
 *
 * @param stream - Name of the stream.
 * @returns The subjects and their message counts.
 */
function streamSubjects(stream: string): Record<string, number> {
  const output = compose(
    'exec',
    '-T',
    'nats-streams',
    'nats',
    'stream',
    'subjects',
    stream,
    '--json',
  );
  return output.trim() === '' ? {} : (JSON.parse(output) as Record<string, number>);
}

/**
 * Creates an Ed25519 key pair in the JWK forms the internal token uses.
 *
 * @param kid - Key id.
 * @returns The public key for the verifier and the private key for a signer.
 */
function keyPair(kid: string): {
  readonly publicJwk: Ed25519PublicJwk;
  readonly privateJwk: Ed25519PrivateJwk;
} {
  const { x, d } = generateKeyPairSync('ed25519').privateKey.export({ format: 'jwk' });
  if (x === undefined || d === undefined) {
    throw new Error('Node returned an Ed25519 JWK without its key material.');
  }
  const publicJwk: Ed25519PublicJwk = { kty: 'OKP', crv: 'Ed25519', x, kid };
  return { publicJwk, privateJwk: { ...publicJwk, d } };
}

/**
 * Applies the migrations with `src/migrate.ts`, as the migration container does.
 */
async function runMigrator(): Promise<void> {
  vi.resetModules();
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  try {
    await import('../src/migrate.js');
  } finally {
    log.mockRestore();
  }
}

describe('identity-service profile', () => {
  const apiGateway = keyPair('test-api-gateway');
  let app: NestExpressApplication;
  let gateway: InternalTokenSigner;
  let migrator: pg.Pool;

  /**
   * The claims of a signed-in user.
   *
   * @param userId - Id of the user.
   * @returns The claims.
   */
  function user(userId: string): InternalTokenClaims {
    return { actor: { type: 'user', id: userId }, organizationId: null };
  }

  /**
   * Patches the profile of an account.
   *
   * @param userId - The actor.
   * @param body - The merge patch.
   * @param ifMatch - The `If-Match` header, if any.
   * @param path - The account of the path, the actor by default.
   * @returns The response.
   */
  async function patch(
    userId: string,
    body: object,
    ifMatch?: string,
    path: string = userId,
  ): Promise<Response> {
    const pending = request(app.getHttpServer())
      .patch(`/internal/v1/users/${path}`)
      .set('Authorization', `Bearer ${await gateway.sign('identity-service', user(userId))}`);
    return (ifMatch === undefined ? pending : pending.set('If-Match', ifMatch)).send(body);
  }

  /**
   * Runs a statement in a system transaction of the application role.
   *
   * @param text - SQL text.
   * @param values - Parameters.
   * @returns The rows.
   */
  async function systemQuery<TRow>(text: string, values: unknown[] = []): Promise<TRow[]> {
    return app
      .get(SystemTransactionRunner)
      .run(async (tx) => (await tx.client.query(text, values)).rows as TRow[]);
  }

  /**
   * Reads the payloads of the outbox rows of `user.profile-updated.v1`, oldest first.
   *
   * @returns The payloads.
   */
  async function profileEvents(): Promise<Record<string, unknown>[]> {
    const rows = await systemQuery<{ payload: Record<string, unknown> }>(
      `select payload from outbox_events where event_name = 'user.profile-updated.v1'
        order by created_at, id`,
    );
    return rows.map(({ payload }) => payload);
  }

  beforeAll(async () => {
    compose(
      'up',
      '--detach',
      '--wait',
      '--wait-timeout',
      '120',
      'postgres',
      'nats',
      'nats-streams',
    );
    const postgresPort = hostPort('postgres', '5432');
    const natsPort = hostPort('nats', '4222');
    const migratorUrl = `postgres://identity_migrator:identity_migrator@127.0.0.1:${postgresPort}/identity`;

    vi.stubEnv('MIGRATION_DATABASE_URL', migratorUrl);
    await runMigrator();
    migrator = new pg.Pool({ connectionString: migratorUrl, max: 1 });
    await migrator.query(
      `insert into users (id, email, name, email_verified_at, version)
       values ($1, 'camille.martin@ateliernord.fr', 'Camille Martin', now(), 2),
              ($2, 'ines.robert@ateliernord.fr', 'Inès Robert', now(), 2)`,
      [camilleId, inesId],
    );

    vi.stubEnv('PORT', '3010');
    vi.stubEnv('LOG_PRETTY', 'false');
    vi.stubEnv('LOG_LEVEL', 'info');
    vi.stubEnv(
      'DATABASE_URL',
      `postgres://identity_app:identity_app@127.0.0.1:${postgresPort}/identity`,
    );
    vi.stubEnv('NATS_URL', `nats://127.0.0.1:${natsPort}`);
    vi.stubEnv('NATS_USER', 'identity');
    vi.stubEnv('NATS_PASSWORD', 'identity');
    vi.stubEnv('INTERNAL_TOKEN_AUDIENCE', 'identity-service');
    vi.stubEnv(
      'INTERNAL_TOKEN_TRUSTED_ISSUERS',
      JSON.stringify({ 'api-gateway': [apiGateway.publicJwk] }),
    );
    vi.stubEnv('PASSWORD_PEPPER', 'integration-test-password-pepper-profile-000000');
    vi.stubEnv('WEBAUTHN_RP_ID', 'app.cadenway.localhost');
    vi.stubEnv('WEBAUTHN_ORIGINS', 'http://app.cadenway.localhost');

    const config = loadConfig(appConfigSchema);
    app = await createApplication(AppModule, {
      service: 'identity-service',
      config,
      provideConfig: true,
      internalToken: {
        verifier: {
          audience: config.INTERNAL_TOKEN_AUDIENCE,
          trustedIssuers: config.INTERNAL_TOKEN_TRUSTED_ISSUERS,
        },
      },
      logDestination: { write: (): void => undefined },
    });
    await app.init();
    gateway = await InternalTokenSigner.create({
      issuer: 'api-gateway',
      privateJwk: apiGateway.privateJwk,
    });
  });

  afterAll(async () => {
    try {
      await app.close();
      await migrator.end();
    } finally {
      vi.unstubAllEnvs();
      compose('down', '--volumes', '--remove-orphans');
    }
  });

  it('reads an account that never set its profile with the defaults of the contract', async () => {
    const response = await request(app.getHttpServer())
      .get(`/internal/v1/users/${camilleId}`)
      .set('Authorization', `Bearer ${await gateway.sign('identity-service', user(camilleId))}`);

    expect(response.status).toBe(200);
    expect(response.headers.etag).toBe('"2"');
    expect(response.body).toEqual({
      id: camilleId,
      name: 'Camille Martin',
      email: 'camille.martin@ateliernord.fr',
      language: 'fr',
      displayName: null,
      jobTitle: null,
      timeZone: 'Europe/Paris',
      passwordChangedAt: expect.any(String) as unknown,
      version: 2,
    });
  });

  it('applies a merge patch with the next version and emits user.profile-updated.v1', async () => {
    const response = await patch(
      camilleId,
      { displayName: ' camille ', jobTitle: 'Responsable produit', timeZone: 'America/Montreal' },
      '"2"',
    );

    expect(response.status).toBe(200);
    expect(response.headers.etag).toBe('"3"');
    expect(response.body).toEqual({
      id: camilleId,
      name: 'Camille Martin',
      email: 'camille.martin@ateliernord.fr',
      language: 'fr',
      displayName: 'camille',
      jobTitle: 'Responsable produit',
      timeZone: 'America/Montreal',
      passwordChangedAt: expect.any(String) as unknown,
      version: 3,
    });
    expect(await profileEvents()).toEqual([
      {
        id: expect.any(String) as unknown,
        occurredAt: expect.any(String) as unknown,
        organizationId: null,
        actor: { type: 'user', id: camilleId },
        version: 3,
        userId: camilleId,
        name: 'Camille Martin',
        displayName: 'camille',
        jobTitle: 'Responsable produit',
        timeZone: 'America/Montreal',
        language: 'fr',
        changed: ['displayName', 'jobTitle', 'timeZone'],
      },
    ]);
  });

  it('answers the same version and emits nothing for a patch that changes nothing', async () => {
    const response = await patch(camilleId, {
      name: 'Camille Martin',
      timeZone: 'America/Montreal',
    });
    const empty = await patch(camilleId, {});

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ version: 3 });
    expect(empty.status).toBe(200);
    expect(empty.body).toMatchObject({ version: 3 });
    expect(await profileEvents()).toHaveLength(1);
  });

  it('clears the display name and the job title with null, and changes the language', async () => {
    const response = await patch(
      camilleId,
      { displayName: null, jobTitle: null, language: 'en' },
      '*',
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      displayName: null,
      jobTitle: null,
      language: 'en',
      timeZone: 'America/Montreal',
      version: 4,
    });
    expect((await profileEvents()).at(-1)).toMatchObject({
      version: 4,
      changed: ['displayName', 'jobTitle', 'language'],
    });
  });

  it('refuses a version If-Match does not name, with the current one, and a malformed header', async () => {
    const stale = await patch(camilleId, { jobTitle: 'CTO' }, '"3"');
    const malformed = await patch(camilleId, { jobTitle: 'CTO' }, 'three');

    expect(stale.status).toBe(412);
    expect(stale.body).toMatchObject({ code: 'request.version-mismatch', details: { version: 4 } });
    expect(malformed.status).toBe(400);
    expect(malformed.body).toMatchObject({
      code: 'request.invalid',
      details: { issues: [{ in: 'header', path: 'If-Match', code: 'invalid_format' }] },
    });
    expect(await profileEvents()).toHaveLength(2);
  });

  it('refuses an unknown time zone and a blank name, one issue each, and null for the language', async () => {
    const response = await patch(camilleId, { name: '  ', timeZone: 'Europe/Atlantis' });
    const nullLanguage = await patch(camilleId, { language: null });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'request.invalid' });
    const paths = (response.body as { details: { issues: { path: string }[] } }).details.issues.map(
      ({ path }) => path,
    );
    expect(paths.sort()).toEqual(['name', 'timeZone']);
    expect(nullLanguage.status).toBe(400);
    expect(nullLanguage.body).toMatchObject({ code: 'request.invalid' });
  });

  it('answers not found for the profile of another account and an unknown one', async () => {
    const other = await patch(inesId, { jobTitle: 'CTO' }, undefined, camilleId);
    const unknown = await patch('019a5f3c-8d2e-7c4a-9b1f-ffffffffffff', { jobTitle: 'CTO' });

    for (const response of [other, unknown]) {
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ code: 'user.not-found' });
    }
  });

  it('rolls back the profile and its event when the work fails', async () => {
    const unitOfWork = new SystemAccountsUnitOfWork(
      app.get(SystemTransactionRunner),
      app.get(OutboxWriter),
      app.get(OutboxRelay),
      app.get(JobProducer),
    );
    const before = await profileEvents();

    await expect(
      unitOfWork.run(async (store) => {
        const loaded = await store.users.lock(inesId);
        if (loaded === null) {
          throw new Error('The account of Inès Robert is missing.');
        }
        const update = loaded.updateProfile({ jobTitle: 'Designer' });
        await store.users.update(update.user);
        await store.events.userProfileUpdated(update.user, update.changed);
        throw new Error('the work fails after its writes');
      }),
    ).rejects.toThrow('the work fails after its writes');

    expect(
      (await migrator.query('select job_title, version from users where id = $1', [inesId])).rows,
    ).toEqual([{ job_title: null, version: 2 }]);
    expect(await profileEvents()).toEqual(before);
  });

  it('publishes the profile changes on evt.user.profile-updated.v1', async () => {
    await vi.waitFor(
      async () => {
        app.get(OutboxRelay).wake();
        const pending = await systemQuery<{ count: number }>(
          `select count(*)::int as count from outbox_events where status <> 'sent'`,
        );
        expect(pending).toEqual([{ count: 0 }]);
      },
      { timeout: 15_000, interval: 250 },
    );

    expect(streamSubjects('EVENTS')).toEqual({ 'evt.user.profile-updated.v1': 2 });
  });
});
