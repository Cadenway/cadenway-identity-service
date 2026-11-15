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
import { OutboxRelay, OutboxWriter } from '@cadenway/nest-messaging/outbox';
import type { NestExpressApplication } from '@nestjs/platform-express';
import pg from 'pg';
import request from 'supertest';
import type { Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { appConfigSchema } from '../src/config/app-config.js';
import { EmailAddress } from '../src/modules/accounts/domain/email-address.js';
import { User } from '../src/modules/accounts/domain/user.js';
import { SystemAccountsUnitOfWork } from '../src/modules/accounts/infrastructure/persistence/system-accounts-unit-of-work.js';
import { OpenSession } from '../src/modules/sessions/application/commands/open-session.js';

// The seven authentication flows, the introspection, the revocation and the reading of a user,
// through HTTP as the API gateway calls them, on the service as main.ts assembles it, against a
// disposable PostgreSQL and NATS started from compose.dev.yaml (see service-wiring.int-spec.ts for
// why Compose rather than containers of @cadenway/nest-testing). Time-dependent rules (the 30 s
// throttle, the expiry of a code, the inactivity of a session) are reached by moving the stored
// instants back as the migrator role, never by waiting.

/** Compose file of the development dependencies. */
const composeFile: string = fileURLToPath(new URL('../compose.dev.yaml', import.meta.url));

/** Throwaway project name, distinct from the wiring test and from any developer stack. */
const project = `cadenway-identity-service-auth-test-${String(process.pid)}`;

/** A pepper for the run only. */
const pepper = 'integration-test-password-pepper-auth-flows-0000';

/** The password of the mockup's examples, 22 characters. */
const password = 'atelier-nord-sprint-14';

/** Camille Martin (CM), of Atelier Nord, the person the mockup signs up and in. */
const camille = { name: 'Camille Martin', email: 'camille.martin@ateliernord.fr' } as const;

/** The browser of the contract's examples. */
const client = {
  ipAddress: '86.247.12.30',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0',
} as const;

/** Every secret the run handled: passwords, codes and tokens, none of which may reach a log line. */
const secrets: string[] = [password, pepper];

/** Every log line the application wrote. */
const logLines: string[] = [];

/** Matches any string, typed for an object literal. */
const anyString: unknown = expect.any(String);

/**
 * Matches a string against a pattern, typed for an object literal.
 *
 * @param pattern - The pattern.
 * @returns The asymmetric matcher.
 */
function matching(pattern: RegExp): unknown {
  return expect.stringMatching(pattern);
}

/**
 * Matches an object that has at least these members, typed for an object literal.
 *
 * @param shape - The members.
 * @returns The asymmetric matcher.
 */
function containing(shape: object): unknown {
  return expect.objectContaining(shape);
}

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

describe('identity-service authentication flows', () => {
  const apiGateway = keyPair('test-api-gateway');
  const realtimeGateway = keyPair('test-realtime-gateway');
  let app: NestExpressApplication;
  let gateway: InternalTokenSigner;
  let realtime: InternalTokenSigner;
  let migrator: pg.Pool;
  let camilleId = '';
  let camilleToken = '';
  let camilleSessionId = '';

  /**
   * Signs an internal token of the API gateway for identity-service.
   *
   * @param claims - The actor and organization of the call.
   * @param signer - The issuer, the API gateway by default.
   * @returns The bearer token.
   */
  async function bearer(
    claims: InternalTokenClaims,
    signer: InternalTokenSigner = gateway,
  ): Promise<string> {
    return `Bearer ${await signer.sign('identity-service', claims)}`;
  }

  /** The claims of the flows that run before a session exists. */
  const anonymous: InternalTokenClaims = {
    actor: { type: 'anonymous', id: null },
    organizationId: null,
  };

  /** The claims of the introspection: the gateway acting as itself. */
  const system: InternalTokenClaims = {
    actor: { type: 'system', id: 'api-gateway' },
    organizationId: null,
  };

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
   * Posts a JSON body to a route of the service.
   *
   * @param path - Path of the route.
   * @param body - Body of the request.
   * @param claims - Claims of the internal token.
   * @returns The response.
   */
  async function post(
    path: string,
    body: object,
    claims: InternalTokenClaims = anonymous,
  ): Promise<Response> {
    return request(app.getHttpServer())
      .post(path)
      .set('Authorization', await bearer(claims))
      .send(body);
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
   * Reads the latest code emailed to an address for a purpose, from the outbox row of its
   * restricted event, as notification-service would receive it.
   *
   * @param email - Recipient address.
   * @param purpose - Purpose of the code.
   * @returns The 6 digits.
   */
  async function latestCode(email: string, purpose: string): Promise<string> {
    const rows = await systemQuery<{ code: string }>(
      `select payload->>'code' as code from outbox_events
        where event_name = 'one-time-code.issued.v1'
          and payload->'recipient'->>'email' = $1 and payload->>'purpose' = $2
        order by created_at desc, id desc limit 1`,
      [email, purpose],
    );
    const code = rows[0]?.code;
    if (code === undefined) {
      throw new Error(`No code was issued to ${email} for ${purpose}.`);
    }
    secrets.push(code);
    return code;
  }

  /**
   * Counts the outbox rows of an event.
   *
   * @param name - Event name.
   * @returns The number of rows.
   */
  async function eventCount(name: string): Promise<number> {
    const rows = await systemQuery<{ count: number }>(
      'select count(*)::int as count from outbox_events where event_name = $1',
      [name],
    );
    return rows[0]?.count ?? 0;
  }

  /**
   * Moves the last code request of an address back by 31 seconds, past the 30-second throttle; the
   * hourly count of the address is kept.
   *
   * @param email - The address.
   */
  async function passThrottle(email: string): Promise<void> {
    await migrator.query(
      `update code_requests set last_requested_at = last_requested_at - interval '31 seconds'
        where email = $1`,
      [email],
    );
  }

  /**
   * A code different from `code`, of 6 digits.
   *
   * @param code - A code.
   * @returns Another code.
   */
  function wrong(code: string): string {
    return code === '000000' ? '111111' : '000000';
  }

  /**
   * Remembers the token of a session for the log check, and returns the response.
   *
   * @param response - A response that issued a session.
   * @returns The same response.
   */
  function issued(response: Response): Response {
    const token = (response.body as { token?: unknown }).token;
    if (typeof token === 'string') {
      secrets.push(token);
    }
    return response;
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

    vi.stubEnv('PORT', '3010');
    vi.stubEnv('LOG_PRETTY', 'false');
    vi.stubEnv('LOG_LEVEL', 'debug');
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
      JSON.stringify({
        'api-gateway': [apiGateway.publicJwk],
        'realtime-gateway': [realtimeGateway.publicJwk],
      }),
    );
    vi.stubEnv('PASSWORD_PEPPER', pepper);

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
      logDestination: {
        write: (line: string): void => {
          logLines.push(line);
        },
      },
    });
    await app.init();
    gateway = await InternalTokenSigner.create({
      issuer: 'api-gateway',
      privateJwk: apiGateway.privateJwk,
    });
    realtime = await InternalTokenSigner.create({
      issuer: 'realtime-gateway',
      privateJwk: realtimeGateway.privateJwk,
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

  describe('the internal token of the routes', () => {
    it('refuses a call without a token', async () => {
      const response = await request(app.getHttpServer())
        .post('/internal/v1/auth/sign-in-methods')
        .send({ email: camille.email });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'auth.token-missing' });
    });

    it('refuses every issuer but the API gateway', async () => {
      const calls = [
        request(app.getHttpServer())
          .post('/internal/v1/auth/sign-up')
          .set('Authorization', await bearer(anonymous, realtime))
          .send({ ...camille, password, acceptTerms: true }),
        request(app.getHttpServer())
          .post('/internal/v1/tokens/introspect')
          .set('Authorization', await bearer(system, realtime))
          .send({ token: 'x' }),
        request(app.getHttpServer())
          .get('/internal/v1/users/019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30')
          .set(
            'Authorization',
            await bearer(user('019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30'), realtime),
          ),
        request(app.getHttpServer())
          .delete('/internal/v1/sessions/019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60')
          .set(
            'Authorization',
            await bearer(user('019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30'), realtime),
          ),
      ];

      for (const response of await Promise.all(calls)) {
        expect(response.status).toBe(403);
        expect(response.body).toMatchObject({ code: 'auth.issuer-not-allowed' });
      }
    });

    it('refuses an actor the route does not accept', async () => {
      const userClaims = user('019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30');
      const flows = await post(
        '/internal/v1/auth/sign-in-methods',
        { email: camille.email },
        userClaims,
      );
      const introspection = await post('/internal/v1/tokens/introspect', { token: 'x' }, anonymous);
      const reading = await request(app.getHttpServer())
        .get('/internal/v1/users/019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30')
        .set('Authorization', await bearer(system));
      const revocation = await request(app.getHttpServer())
        .delete('/internal/v1/sessions/019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60')
        .set('Authorization', await bearer(anonymous));

      for (const response of [flows, introspection, reading, revocation]) {
        expect(response.status).toBe(403);
        expect(response.body).toMatchObject({ code: 'auth.actor-not-allowed' });
      }
    });
  });

  describe('POST /internal/v1/auth/sign-in-methods', () => {
    it('offers the password and the email code to any address', async () => {
      const response = await post('/internal/v1/auth/sign-in-methods', {
        email: 'nobody@ateliernord.fr',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ methods: [{ type: 'password' }, { type: 'email-code' }] });
    });

    it('refuses an address that is not one', async () => {
      const response = await post('/internal/v1/auth/sign-in-methods', { email: 'camille' });

      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toMatch(/^application\/problem\+json/u);
      expect(response.body).toMatchObject({ code: 'request.invalid' });
    });
  });

  describe('POST /internal/v1/auth/sign-up', () => {
    it('refuses the sign-up when the terms are not accepted', async () => {
      const response = await post('/internal/v1/auth/sign-up', {
        ...camille,
        password,
        acceptTerms: false,
      });

      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({ code: 'auth.terms-not-accepted' });
    });

    it('refuses a password of fewer than 12 characters, with the minimum', async () => {
      secrets.push('court-11car');
      const response = await post('/internal/v1/auth/sign-up', {
        ...camille,
        password: 'court-11car',
        acceptTerms: true,
      });

      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({
        code: 'auth.password-too-short',
        details: { minLength: 12 },
      });
    });

    it('refuses a compromised password', async () => {
      const response = await post('/internal/v1/auth/sign-up', {
        ...camille,
        password: 'Password1234',
        acceptTerms: true,
      });

      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({ code: 'auth.password-compromised' });
    });

    it('refuses a name made of spaces only', async () => {
      const response = await post('/internal/v1/auth/sign-up', {
        ...camille,
        name: '   ',
        password,
        acceptTerms: true,
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'request.invalid' });
      expect(await eventCount('user.signed-up.v1')).toBe(0);
    });

    it('creates an unverified account and issues an email-verification code', async () => {
      const before = Date.now();
      const response = await post('/internal/v1/auth/sign-up', {
        name: '  Camille Martin ',
        email: 'Camille.Martin@AtelierNord.fr',
        password,
        acceptTerms: true,
      });

      expect(response.status).toBe(202);
      const body = response.body as { email: string; expiresAt: string; resendAvailableAt: string };
      expect(body.email).toBe(camille.email);
      expect(Date.parse(body.expiresAt) - before).toBeGreaterThanOrEqual(10 * 60_000 - 1000);
      expect(Date.parse(body.expiresAt) - before).toBeLessThanOrEqual(10 * 60_000 + 5000);
      expect(Date.parse(body.resendAvailableAt) - before).toBeGreaterThanOrEqual(29_000);

      const users = await migrator.query<{
        id: string;
        name: string;
        email_verified_at: Date | null;
        version: number;
      }>('select id, name, email_verified_at, version from users where email = $1', [
        camille.email,
      ]);
      expect(users.rows).toEqual([
        { id: anyString, name: 'Camille Martin', email_verified_at: null, version: 1 },
      ]);
      camilleId = users.rows[0]?.id ?? '';
      const signedUp = await systemQuery<{ payload: Record<string, unknown> }>(
        `select payload from outbox_events where event_name = 'user.signed-up.v1'`,
      );
      expect(signedUp.map(({ payload }) => payload)).toEqual([
        expect.objectContaining({
          organizationId: null,
          actor: { type: 'user', id: camilleId },
          version: 1,
          userId: camilleId,
          email: camille.email,
          name: 'Camille Martin',
          language: 'fr',
        }),
      ]);
      const codes = await systemQuery<{
        payload: Record<string, unknown>;
        subject: string;
        stream: string;
      }>(
        `select payload, subject, stream from outbox_events where event_name = 'one-time-code.issued.v1'`,
      );
      expect(codes).toEqual([
        {
          subject: 'restricted.one-time-code.issued.v1',
          stream: 'EVENTS_RESTRICTED',
          payload: containing({
            organizationId: null,
            actor: { type: 'system', id: 'identity-service' },
            version: 1,
            userId: camilleId,
            purpose: 'email-verification',
            code: matching(/^\d{6}$/u),
            expiresAt: body.expiresAt,
            recipient: { email: camille.email, name: 'Camille Martin' },
            language: 'fr',
          }),
        },
      ]);
    });

    it('stores neither the password nor the code in clear', async () => {
      const code = await latestCode(camille.email, 'email-verification');
      const stored = await migrator.query<{ password_hash: string; code_hash: string }>(
        `select password_hash, code_hash from password_credentials
           join one_time_codes using (user_id) where user_id = $1`,
        [camilleId],
      );

      expect(stored.rows[0]?.password_hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/u);
      expect(JSON.stringify(stored.rows)).not.toContain(password);
      expect(JSON.stringify(stored.rows)).not.toContain(code);
    });

    it('throttles a new sign-up of the address for 30 seconds', async () => {
      const response = await post('/internal/v1/auth/sign-up', {
        ...camille,
        password,
        acceptTerms: true,
      });

      expect(response.status).toBe(429);
      expect(response.body).toMatchObject({
        code: 'auth.code-throttled',
        details: { resendAvailableAt: anyString },
      });
      expect(Number(response.headers['retry-after'])).toBeGreaterThanOrEqual(1);
      expect(Number(response.headers['retry-after'])).toBeLessThanOrEqual(30);
    });

    it('signs an unverified address up again, keeping its account, with the next version', async () => {
      const first = await latestCode(camille.email, 'email-verification');
      await passThrottle(camille.email);

      const response = await post('/internal/v1/auth/sign-up', {
        ...camille,
        password,
        acceptTerms: true,
      });

      expect(response.status).toBe(202);
      const versions = await systemQuery<{ version: number; user_id: string }>(
        `select (payload->>'version')::int as version, payload->>'userId' as user_id
           from outbox_events where event_name = 'user.signed-up.v1' order by created_at`,
      );
      expect(versions).toEqual([
        { version: 1, user_id: camilleId },
        { version: 2, user_id: camilleId },
      ]);
      const current = await latestCode(camille.email, 'email-verification');
      // The code of the first email stopped working (unless the draw repeated it, one in a million).
      if (current !== first) {
        const old = await post('/internal/v1/auth/sign-up/verification', {
          email: camille.email,
          code: first,
          client,
        });
        expect(old.status).toBe(422);
        expect(old.body).toMatchObject({ code: 'auth.code-expired' });
      }
    });
  });

  describe('POST /internal/v1/auth/sign-up/code', () => {
    it('answers the same for an address without an account, and issues nothing', async () => {
      const before = await eventCount('one-time-code.issued.v1');
      const response = await post('/internal/v1/auth/sign-up/code', {
        email: 'nobody@ateliernord.fr',
      });

      expect(response.status).toBe(202);
      expect(response.body).toEqual({
        email: 'nobody@ateliernord.fr',
        expiresAt: anyString,
        resendAvailableAt: anyString,
      });
      expect(await eventCount('one-time-code.issued.v1')).toBe(before);
    });

    it('throttles the address within 30 seconds, account or not', async () => {
      const response = await post('/internal/v1/auth/sign-up/code', {
        email: 'nobody@ateliernord.fr',
      });

      expect(response.status).toBe(429);
      expect(response.body).toMatchObject({ code: 'auth.code-throttled' });
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('issues a new code to an unverified account, replacing the previous one', async () => {
      const previous = await latestCode(camille.email, 'email-verification');
      await passThrottle(camille.email);

      const response = await post('/internal/v1/auth/sign-up/code', { email: camille.email });

      expect(response.status).toBe(202);
      const current = await latestCode(camille.email, 'email-verification');
      const working = await migrator.query<{ count: number }>(
        `select count(*)::int as count from one_time_codes
          where user_id = $1 and consumed_at is null and replaced_at is null`,
        [camilleId],
      );
      expect(working.rows).toEqual([{ count: 1 }]);
      if (previous !== current) {
        const old = await post('/internal/v1/auth/sign-up/verification', {
          email: camille.email,
          code: previous,
          client,
        });
        expect(old.status).toBe(422);
        expect(old.body).toMatchObject({ code: 'auth.code-expired' });
      }
    });
  });

  describe('POST /internal/v1/auth/sign-up/verification', () => {
    it('refuses a malformed code', async () => {
      const response = await post('/internal/v1/auth/sign-up/verification', {
        email: camille.email,
        code: '48291',
        client,
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'request.invalid' });
    });

    it('refuses a wrong code', async () => {
      const code = await latestCode(camille.email, 'email-verification');
      const response = await post('/internal/v1/auth/sign-up/verification', {
        email: camille.email,
        code: wrong(code),
        client,
      });

      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({ code: 'auth.code-invalid' });
    });

    it('answers like a wrong code for an address without an account', async () => {
      const response = await post('/internal/v1/auth/sign-up/verification', {
        email: 'nobody@ateliernord.fr',
        code: '482913',
        client,
      });

      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({ code: 'auth.code-invalid' });
    });

    it('verifies the address and opens a session that ends with the browser', async () => {
      const code = await latestCode(camille.email, 'email-verification');
      const before = Date.now();

      const response = issued(
        await post('/internal/v1/auth/sign-up/verification', {
          email: camille.email,
          code,
          client,
        }),
      );

      expect(response.status).toBe(200);
      const body = response.body as {
        token: string;
        session: { id: string; expiresAt: string; persistent: boolean };
        user: Record<string, unknown>;
      };
      expect(body.token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
      expect(body.session.persistent).toBe(false);
      expect(Date.parse(body.session.expiresAt) - before).toBeGreaterThan(29 * 24 * 60 * 60_000);
      expect(body.user).toEqual({
        id: camilleId,
        name: 'Camille Martin',
        email: camille.email,
        language: 'fr',
        version: 3,
      });
      const verified = await systemQuery<{ payload: Record<string, unknown> }>(
        `select payload from outbox_events where event_name = 'user.email-verified.v1'`,
      );
      expect(verified.map(({ payload }) => payload)).toEqual([
        expect.objectContaining({
          organizationId: null,
          actor: { type: 'user', id: camilleId },
          version: 3,
          userId: camilleId,
          email: camille.email,
        }),
      ]);
      const sessions = await migrator.query<Record<string, unknown>>(
        `select token_hash, ip_address, user_agent, browser, operating_system, device_type, persistent
           from sessions where id = $1`,
        [body.session.id],
      );
      expect(sessions.rows).toEqual([
        {
          token_hash: matching(/^[0-9a-f]{64}$/u),
          ip_address: client.ipAddress,
          user_agent: client.userAgent,
          browser: 'Firefox 145',
          operating_system: 'Windows 10',
          device_type: 'desktop',
          persistent: false,
        },
      ]);
      expect(JSON.stringify(sessions.rows)).not.toContain(body.token);
    });

    it('refuses the code once used, and a verified address awaits no code', async () => {
      const code = await latestCode(camille.email, 'email-verification');
      const response = await post('/internal/v1/auth/sign-up/verification', {
        email: camille.email,
        code,
        client,
      });

      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({ code: 'auth.code-invalid' });
    });

    it('refuses an expired code, and a code after five wrong attempts', async () => {
      const expiring = { name: 'Camille Martin', email: 'camille.martin+expiry@ateliernord.fr' };
      expect(
        (await post('/internal/v1/auth/sign-up', { ...expiring, password, acceptTerms: true }))
          .status,
      ).toBe(202);
      const code = await latestCode(expiring.email, 'email-verification');
      await migrator.query(
        `update one_time_codes set expires_at = now() - interval '1 second'
          where user_id = (select id from users where email = $1)`,
        [expiring.email],
      );
      const expired = await post('/internal/v1/auth/sign-up/verification', {
        email: expiring.email,
        code,
        client,
      });
      expect(expired.status).toBe(422);
      expect(expired.body).toMatchObject({ code: 'auth.code-expired' });

      await passThrottle(expiring.email);
      expect((await post('/internal/v1/auth/sign-up/code', { email: expiring.email })).status).toBe(
        202,
      );
      const fresh = await latestCode(expiring.email, 'email-verification');
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        const response = await post('/internal/v1/auth/sign-up/verification', {
          email: expiring.email,
          code: wrong(fresh),
          client,
        });
        expect(response.body).toMatchObject({ code: 'auth.code-invalid' });
      }
      const exhausted = await post('/internal/v1/auth/sign-up/verification', {
        email: expiring.email,
        code: fresh,
        client,
      });
      expect(exhausted.status).toBe(422);
      expect(exhausted.body).toMatchObject({ code: 'auth.code-expired' });
    });

    it('refuses the sign-up of a verified address', async () => {
      await passThrottle(camille.email);
      const response = await post('/internal/v1/auth/sign-up', {
        ...camille,
        password,
        acceptTerms: true,
      });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ code: 'auth.email-taken' });
    });
  });

  describe('POST /internal/v1/auth/sign-in', () => {
    it('signs in with the password and keeps the session 30 days when asked', async () => {
      const before = Date.now();
      const response = issued(
        await post('/internal/v1/auth/sign-in', {
          email: camille.email,
          password,
          rememberMe: true,
          client,
        }),
      );

      expect(response.status).toBe(200);
      const body = response.body as {
        token: string;
        session: { id: string; expiresAt: string; persistent: boolean };
        user: { id: string; version: number };
      };
      expect(body.session.persistent).toBe(true);
      expect(Date.parse(body.session.expiresAt) - before).toBeGreaterThanOrEqual(
        30 * 24 * 60 * 60_000 - 1000,
      );
      expect(Date.parse(body.session.expiresAt) - before).toBeLessThanOrEqual(
        30 * 24 * 60 * 60_000 + 5000,
      );
      expect(body.user).toMatchObject({ id: camilleId, version: 3 });
      camilleToken = body.token;
      camilleSessionId = body.session.id;
    });

    it('counts the failures down, then locks the address for 15 minutes', async () => {
      const remaining: unknown[] = [];
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        const response = await post('/internal/v1/auth/sign-in', {
          email: camille.email,
          password: 'not-the-password-of-camille',
          client,
        });
        expect(response.status).toBe(422);
        expect(response.body).toMatchObject({ code: 'auth.invalid-credentials' });
        remaining.push(
          (response.body as { details: { remainingAttempts: number } }).details.remainingAttempts,
        );
      }
      expect(remaining).toEqual([4, 3, 2, 1]);

      const before = Date.now();
      const last = await post('/internal/v1/auth/sign-in', {
        email: camille.email,
        password: 'not-the-password-of-camille',
        client,
      });
      expect(last.status).toBe(429);
      expect(last.body).toMatchObject({ code: 'auth.account-locked' });
      const lockedUntil = Date.parse(
        (last.body as { details: { lockedUntil: string } }).details.lockedUntil,
      );
      expect(lockedUntil - before).toBeGreaterThanOrEqual(15 * 60_000 - 1000);
      expect(lockedUntil - before).toBeLessThanOrEqual(15 * 60_000 + 5000);
      expect(Number(last.headers['retry-after'])).toBeGreaterThan(14 * 60);

      const right = await post('/internal/v1/auth/sign-in', {
        email: camille.email,
        password,
        client,
      });
      expect(right.status).toBe(429);
      expect(right.body).toMatchObject({ code: 'auth.account-locked' });
    });

    it('counts the failures of an address without an account the same way', async () => {
      const response = await post('/internal/v1/auth/sign-in', {
        email: 'nobody@ateliernord.fr',
        password,
        client,
      });

      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({
        code: 'auth.invalid-credentials',
        details: { remainingAttempts: 4 },
      });
    });

    it('refuses the right password of an unverified account', async () => {
      const pending = { name: 'Camille Martin', email: 'camille.martin+pending@ateliernord.fr' };
      expect(
        (await post('/internal/v1/auth/sign-up', { ...pending, password, acceptTerms: true }))
          .status,
      ).toBe(202);

      const response = await post('/internal/v1/auth/sign-in', {
        email: pending.email,
        password,
        client,
      });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'auth.email-not-verified' });
    });

    it('resets the count after a successful sign-in', async () => {
      const expiring = 'camille.martin+expiry@ateliernord.fr';
      await post('/internal/v1/auth/sign-in', {
        email: expiring,
        password: 'not-the-password',
        client,
      });
      const second = await post('/internal/v1/auth/sign-in', {
        email: expiring,
        password: 'not-the-password',
        client,
      });
      expect(second.body).toMatchObject({ details: { remainingAttempts: 3 } });

      // The account of this address is not verified: the right password resets the count all the same.
      expect(
        (await post('/internal/v1/auth/sign-in', { email: expiring, password, client })).status,
      ).toBe(403);
      const after = await post('/internal/v1/auth/sign-in', {
        email: expiring,
        password: 'not-the-password',
        client,
      });
      expect(after.body).toMatchObject({ details: { remainingAttempts: 4 } });
    });
  });

  describe('POST /internal/v1/auth/sign-in/code and its verification', () => {
    it('issues a sign-in code to a verified account, and answers the same otherwise', async () => {
      // The throttle of an address is shared by its sign-up and sign-in codes.
      await passThrottle(camille.email);
      const before = await eventCount('one-time-code.issued.v1');

      const verified = await post('/internal/v1/auth/sign-in/code', { email: camille.email });
      const unknown = await post('/internal/v1/auth/sign-in/code', {
        email: 'someone@ateliernord.fr',
      });

      expect(verified.status).toBe(202);
      expect(unknown.status).toBe(202);
      expect(Object.keys(unknown.body as object).sort()).toEqual(
        Object.keys(verified.body as object).sort(),
      );
      expect(await eventCount('one-time-code.issued.v1')).toBe(before + 1);
    });

    it('throttles the sign-in code of the address for 30 seconds', async () => {
      const response = await post('/internal/v1/auth/sign-in/code', { email: camille.email });

      expect(response.status).toBe(429);
      expect(response.body).toMatchObject({ code: 'auth.code-throttled' });
    });

    it('refuses a wrong code and an address without a verified account', async () => {
      const code = await latestCode(camille.email, 'sign-in');
      const wrongCode = await post('/internal/v1/auth/sign-in/code/verification', {
        email: camille.email,
        code: wrong(code),
        client,
      });
      const unknown = await post('/internal/v1/auth/sign-in/code/verification', {
        email: 'camille.martin+pending@ateliernord.fr',
        code,
        client,
      });

      expect(wrongCode.status).toBe(422);
      expect(wrongCode.body).toMatchObject({ code: 'auth.code-invalid' });
      expect(unknown.status).toBe(422);
      expect(unknown.body).toMatchObject({ code: 'auth.code-invalid' });
    });

    it('signs in with the code, even while the password sign-in is locked', async () => {
      const code = await latestCode(camille.email, 'sign-in');

      const response = issued(
        await post('/internal/v1/auth/sign-in/code/verification', {
          email: camille.email,
          code,
          rememberMe: false,
          client: { ipAddress: '2001:db8::1', userAgent: null },
        }),
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        session: { persistent: false },
        user: { id: camilleId, email: camille.email },
      });
    });

    it('refuses the code once used', async () => {
      const code = await latestCode(camille.email, 'sign-in');
      const response = await post('/internal/v1/auth/sign-in/code/verification', {
        email: camille.email,
        code,
        client,
      });

      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({ code: 'auth.code-expired' });
    });
  });

  describe('POST /internal/v1/tokens/introspect', () => {
    it('answers an active session with its subject', async () => {
      const response = await post(
        '/internal/v1/tokens/introspect',
        { token: camilleToken },
        system,
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        active: true,
        tokenType: 'session',
        sessionId: camilleSessionId,
        userId: camilleId,
        organizationId: null,
        role: null,
        scopes: [],
        expiresAt: anyString,
      });
    });

    it('answers inactive for an unknown or a malformed token, never an error', async () => {
      const unknown = await post(
        '/internal/v1/tokens/introspect',
        { token: 'A'.repeat(43) },
        system,
      );
      const malformed = await post(
        '/internal/v1/tokens/introspect',
        { token: 'not a token' },
        system,
      );

      expect(unknown.status).toBe(200);
      expect(unknown.body).toEqual({ active: false });
      expect(malformed.status).toBe(200);
      expect(malformed.body).toEqual({ active: false });
    });

    it('refuses a body without a token', async () => {
      const response = await post('/internal/v1/tokens/introspect', {}, system);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'request.invalid' });
    });

    it('records the activity, and ends a session after 12 hours without it', async () => {
      // The password sign-in of Camille is locked by an earlier test: end the lockout.
      await migrator.query('delete from sign_in_attempts where email = $1', [camille.email]);
      const session = issued(
        await post('/internal/v1/auth/sign-in', {
          email: camille.email,
          password,
          rememberMe: true,
          client,
        }),
      );
      const {
        token,
        session: { id },
      } = session.body as { token: string; session: { id: string } };

      await migrator.query(
        `update sessions set last_active_at = last_active_at - interval '11 hours' where id = $1`,
        [id],
      );
      expect((await post('/internal/v1/tokens/introspect', { token }, system)).body).toMatchObject({
        active: true,
      });
      const touched = await migrator.query<{ idle: number }>(
        `select extract(epoch from now() - last_active_at)::int as idle from sessions where id = $1`,
        [id],
      );
      expect(touched.rows[0]?.idle).toBeLessThan(60);

      await migrator.query(
        `update sessions set last_active_at = last_active_at - interval '12 hours 1 second' where id = $1`,
        [id],
      );
      expect((await post('/internal/v1/tokens/introspect', { token }, system)).body).toEqual({
        active: false,
      });
    });
  });

  describe('DELETE /internal/v1/sessions/{sessionId}', () => {
    it('refuses a session of another user, and an unknown one', async () => {
      const other = await request(app.getHttpServer())
        .delete(`/internal/v1/sessions/${camilleSessionId}`)
        .set('Authorization', await bearer(user('019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30')));
      const unknown = await request(app.getHttpServer())
        .delete('/internal/v1/sessions/019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60')
        .set('Authorization', await bearer(user(camilleId)));

      expect(other.status).toBe(404);
      expect(other.body).toMatchObject({ code: 'session.not-found' });
      expect(unknown.status).toBe(404);
      expect(unknown.body).toMatchObject({ code: 'session.not-found' });
    });

    it('refuses an id that is not a UUID', async () => {
      const response = await request(app.getHttpServer())
        .delete('/internal/v1/sessions/not-a-uuid')
        .set('Authorization', await bearer(user(camilleId)));

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'request.invalid' });
    });

    it('revokes the session: its token introspects as inactive from the next call', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/internal/v1/sessions/${camilleSessionId}`)
        .set('Authorization', await bearer(user(camilleId)));

      expect(response.status).toBe(204);
      expect(
        (await post('/internal/v1/tokens/introspect', { token: camilleToken }, system)).body,
      ).toEqual({ active: false });
      const revoked = await systemQuery<{ payload: Record<string, unknown> }>(
        `select payload from outbox_events where event_name = 'session.revoked.v1'`,
      );
      expect(revoked.map(({ payload }) => payload)).toEqual([
        expect.objectContaining({
          organizationId: null,
          actor: { type: 'user', id: camilleId },
          version: 2,
          sessionId: camilleSessionId,
          userId: camilleId,
        }),
      ]);
    });

    it('answers 204 again for a session already ended, and emits nothing', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/internal/v1/sessions/${camilleSessionId}`)
        .set('Authorization', await bearer(user(camilleId)));

      expect(response.status).toBe(204);
      expect(await eventCount('session.revoked.v1')).toBe(1);
    });
  });

  describe('GET /internal/v1/users/{userId}', () => {
    it('reads the account of the actor, with its version as ETag', async () => {
      const response = await request(app.getHttpServer())
        .get(`/internal/v1/users/${camilleId}`)
        .set('Authorization', await bearer(user(camilleId)));

      expect(response.status).toBe(200);
      expect(response.headers.etag).toBe('"3"');
      expect(response.body).toEqual({
        id: camilleId,
        name: 'Camille Martin',
        email: camille.email,
        language: 'fr',
        version: 3,
      });
    });

    it('answers not found for another account and for an unknown one', async () => {
      const other = await request(app.getHttpServer())
        .get(`/internal/v1/users/${camilleId}`)
        .set('Authorization', await bearer(user('019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30')));
      const unknown = await request(app.getHttpServer())
        .get('/internal/v1/users/019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30')
        .set('Authorization', await bearer(user('019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30')));

      for (const response of [other, unknown]) {
        expect(response.status).toBe(404);
        expect(response.body).toMatchObject({ code: 'user.not-found' });
      }
    });

    it('refuses an id that is not a UUID', async () => {
      const response = await request(app.getHttpServer())
        .get('/internal/v1/users/camille')
        .set('Authorization', await bearer(user(camilleId)));

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'request.invalid' });
    });
  });

  describe('concurrent requests and the hourly cap', () => {
    it('counts every one of parallel wrong passwords of an address', async () => {
      const attempts = await Promise.all(
        Array.from({ length: 5 }, () =>
          post('/internal/v1/auth/sign-in', {
            email: 'concurrent@ateliernord.fr',
            password: 'not-the-password',
            client,
          }),
        ),
      );

      const codes = attempts.map((response) => (response.body as { code: string }).code).sort();
      const remaining = attempts
        .map(
          (response) =>
            (response.body as { details?: { remainingAttempts?: number } }).details
              ?.remainingAttempts,
        )
        .filter((left) => left !== undefined)
        .sort();
      expect(codes).toEqual([
        'auth.account-locked',
        'auth.invalid-credentials',
        'auth.invalid-credentials',
        'auth.invalid-credentials',
        'auth.invalid-credentials',
      ]);
      expect(remaining).toEqual([1, 2, 3, 4]);
    });

    it('counts every one of parallel wrong codes, which then stop the code', async () => {
      const pending = 'camille.martin+pending@ateliernord.fr';
      const code = await latestCode(pending, 'email-verification');

      const attempts = await Promise.all(
        Array.from({ length: 5 }, () =>
          post('/internal/v1/auth/sign-up/verification', {
            email: pending,
            code: wrong(code),
            client,
          }),
        ),
      );

      expect(attempts.map((response) => (response.body as { code: string }).code)).toEqual(
        Array.from({ length: 5 }, () => 'auth.code-invalid'),
      );
      const right = await post('/internal/v1/auth/sign-up/verification', {
        email: pending,
        code,
        client,
      });
      expect(right.body).toMatchObject({ code: 'auth.code-expired' });
    });

    it('accepts 5 code requests of an address in an hour, then refuses until the hour ends', async () => {
      const capped = 'cap@ateliernord.fr';
      const before = Date.now();
      for (let request_ = 0; request_ < 5; request_ += 1) {
        expect((await post('/internal/v1/auth/sign-in/code', { email: capped })).status).toBe(202);
        await passThrottle(capped);
      }

      const refused = await post('/internal/v1/auth/sign-up/code', { email: capped });

      expect(refused.status).toBe(429);
      expect(refused.body).toMatchObject({ code: 'auth.code-throttled' });
      const availableAt = Date.parse(
        (refused.body as { details: { resendAvailableAt: string } }).details.resendAvailableAt,
      );
      expect(availableAt - before).toBeGreaterThan(59 * 60_000);
      expect(Number(refused.headers['retry-after'])).toBeGreaterThan(59 * 60);
    });
  });

  describe('the unit of work', () => {
    it('rolls back the account, its event and the session it opened when the work fails', async () => {
      const unitOfWork = new SystemAccountsUnitOfWork(
        app.get(SystemTransactionRunner),
        app.get(OutboxWriter),
        app.get(OutboxRelay),
      );
      const openSession = app.get(OpenSession, { strict: false });
      const email = EmailAddress.of('rollback@ateliernord.fr');
      const sessionsBefore = await migrator.query<{ count: number }>(
        'select count(*)::int as count from sessions',
      );
      const signedUpBefore = await eventCount('user.signed-up.v1');

      await expect(
        unitOfWork.run(async (store) => {
          const user = await store.users.insert(User.register(email, 'Camille Martin'));
          await store.events.userSignedUp(user);
          await openSession.execute({ userId: user.id, persistent: false, client });
          throw new Error('the work fails after its writes');
        }),
      ).rejects.toThrow('the work fails after its writes');

      const users = await migrator.query('select id from users where email = $1', [email.value]);
      const sessionsAfter = await migrator.query<{ count: number }>(
        'select count(*)::int as count from sessions',
      );
      expect(users.rows).toEqual([]);
      expect(sessionsAfter.rows).toEqual(sessionsBefore.rows);
      expect(await eventCount('user.signed-up.v1')).toBe(signedUpBefore);
    });
  });

  describe('the outbox', () => {
    it('publishes the four events, the code on the restricted subject only', async () => {
      app.get(OutboxRelay).wake();
      await vi.waitFor(
        async () => {
          const pending = await systemQuery<{ count: number }>(
            `select count(*)::int as count from outbox_events where status <> 'sent'`,
          );
          expect(pending).toEqual([{ count: 0 }]);
        },
        { timeout: 15_000, interval: 250 },
      );

      const events = streamSubjects('EVENTS');
      const restricted = streamSubjects('EVENTS_RESTRICTED');

      expect(Object.keys(events).sort()).toEqual([
        'evt.session.revoked.v1',
        'evt.user.email-verified.v1',
        'evt.user.signed-up.v1',
      ]);
      expect(events['evt.user.signed-up.v1']).toBe(await eventCount('user.signed-up.v1'));
      expect(Object.keys(restricted)).toEqual(['restricted.one-time-code.issued.v1']);
      expect(restricted['restricted.one-time-code.issued.v1']).toBe(
        await eventCount('one-time-code.issued.v1'),
      );
    });
  });

  describe('the logs', () => {
    it('never hold a password, a code, a token or the pepper', () => {
      expect(logLines.length).toBeGreaterThan(50);
      expect(secrets.length).toBeGreaterThan(10);
      const leaks = logLines.filter((line) => secrets.some((secret) => line.includes(secret)));

      expect(leaks).toEqual([]);
    });
  });
});
