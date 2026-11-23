import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import type { SearchMembership } from '@cadenway/contracts/types/internal/organization-service';
import {
  ChangePasswordInternalResponse,
  ConfirmPasswordResetInternalResponse,
  InspectPasswordResetLinkInternalResponse,
  ListUserSessionsInternalResponse,
  ReauthenticateInternalResponse,
  RequestPasswordResetInternalResponse,
  ScheduleAccountDeletionInternalResponse,
} from '@cadenway/contracts/validators/internal/identity-service';
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
import { CompleteAccountDeletion } from '../src/modules/accounts/application/use-cases/commands/deletion/complete-account-deletion/complete-account-deletion.use-case.js';
import { EnqueueDueAccountDeletions } from '../src/modules/accounts/application/use-cases/commands/deletion/enqueue-due-account-deletions/enqueue-due-account-deletions.use-case.js';
import { Argon2PasswordHasher } from '../src/modules/accounts/infrastructure/adapters/security/argon2-password-hasher.adapter.js';
import { startOrganizationMembershipAuthority } from './support/organization-membership.fixture.js';

// The security of an account (P2c-1): the change and the reset of the password, the recent
// re-authentication and its guards, the open sessions and their revocation, the change of address,
// the scheduling, the cancellation and the completion of the deletion, and "Nouvelle connexion",
// through HTTP as the API gateway calls them, on the service as main.ts assembles it, against a
// disposable PostgreSQL and NATS started from compose.dev.yaml (see service-wiring.int-spec.ts).
// Accounts are stored by the migrator role with a real argon2id hash, then sign in through the
// route. Time-dependent rules (the 45 s throttle, the 10-minute window, the 30 minutes of a link,
// `deleteAt`, the 90 days of a device) are reached by moving the stored instants back, never by
// waiting. A code and a reset token are read from EVENTS_RESTRICTED, as notification-service
// receives them; the other events from their outbox rows and from EVENTS. The final deletion runs
// through its durable job of @cadenway/nest-jobs: the sweep is called as its schedule would, and the
// worker of `account.delete` completes it.

/** Compose file of the development dependencies. */
const composeFile: string = fileURLToPath(new URL('../compose.dev.yaml', import.meta.url));

/** Throwaway project name, distinct from the other suites and from any developer stack. */
const project = `cadenway-identity-service-security-test-${String(process.pid)}`;

/** A pepper for the run only. */
const pepper = 'integration-test-password-pepper-account-security';

/** The password of the accounts of the run, 22 characters. */
const password = 'atelier-nord-sprint-14';

/** The new password of a change or a reset. */
const newPassword = 'nord-atelier-sprint-15';

/** Atelier Nord, the organization of the mockup. */
const atelierNord = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';

/** Every scope of a session. */
const everyScope = ['tasks:read', 'tasks:write', 'members:read', 'webhooks:manage'];

/** Firefox on Windows, the browser of the contract's examples. */
const firefox = {
  ipAddress: '192.0.2.14',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
} as const;

/** Safari on an iPhone ("Application Cadenway · iPhone 15" of the mockup is a native client). */
const iphone = {
  ipAddress: '86.247.12.30',
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
} as const;

/** Chrome on macOS. */
const chrome = {
  ipAddress: '192.0.2.15',
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
} as const;

/** Every secret the run handled: passwords, codes, tokens and reset links. */
const secrets: string[] = [password, newPassword, pepper];

/** Every log line the application wrote. */
const logLines: string[] = [];

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
 * Reads the payloads of every message of a restricted subject in `EVENTS_RESTRICTED`, oldest
 * first, as notification-service receives them.
 *
 * @param subject - The subject.
 * @returns The payloads.
 */
function restrictedMessages(subject: string): Record<string, unknown>[] {
  const output = compose(
    'exec',
    '-T',
    'nats-streams',
    'nats',
    'subscribe',
    subject,
    '--stream',
    'EVENTS_RESTRICTED',
    '--all',
    '--terminate-at-end',
    '--wait',
    '2s',
    '--raw',
  );
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line) as Record<string, unknown>);
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
 * Applies the migrations and provisions the jobs with `src/migrate.ts`, as the migration container
 * does.
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

/** A signed-in person: the account, the session and its token. */
interface SignedIn {
  readonly userId: string;
  readonly email: string;
  readonly sessionId: string;
  readonly token: string;
}

describe('identity-service account security', () => {
  const apiGateway = keyPair('test-api-gateway');
  const hasher = new Argon2PasswordHasher(pepper);
  const membershipProofs = new Map<string, SearchMembership | Error>();
  const authoritativeOwners = new Map<string, readonly string[]>();
  const reserveAtOrganization = vi.fn((userId: string) => authoritativeOwners.get(userId) ?? []);
  const findMembershipProof = vi.fn((organizationId: string, userId: string) => {
    const proof = membershipProofs.get(`${organizationId}/${userId}`);
    return proof instanceof Error ? Promise.reject(proof) : Promise.resolve(proof ?? null);
  });
  let app: NestExpressApplication;
  let organizationAuthority:
    Awaited<ReturnType<typeof startOrganizationMembershipAuthority>> | undefined;
  let gateway: InternalTokenSigner;
  let migrator: pg.Pool;
  let passwordHash = '';
  let accounts = 0;

  /** The claims of the flows that run before a session exists. */
  const anonymous: InternalTokenClaims = {
    actor: { type: 'anonymous', id: null },
    organizationId: null,
  };

  /** The claims of the introspections: the gateway acting as itself. */
  const system: InternalTokenClaims = {
    actor: { type: 'system', id: 'api-gateway' },
    organizationId: null,
  };

  /**
   * The claims of a signed-in user, with an organization for the routes of the tokens.
   *
   * @param userId - Id of the user.
   * @param organizationId - The current organization, or `null`.
   * @returns The claims.
   */
  function user(userId: string, organizationId: string | null = null): InternalTokenClaims {
    return organizationId === null
      ? { actor: { type: 'user', id: userId }, organizationId: null }
      : { actor: { type: 'user', id: userId }, organizationId, role: 'member', scopes: everyScope };
  }

  /**
   * Sends a request to the service with an internal token of the API gateway.
   *
   * @param method - HTTP method.
   * @param path - Path of the route.
   * @param claims - Claims of the internal token.
   * @param body - Body of the request, if any.
   * @returns The response.
   */
  async function call(
    method: 'get' | 'post' | 'put' | 'delete',
    path: string,
    claims: InternalTokenClaims,
    body?: object,
  ): Promise<Response> {
    const pending = request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${await gateway.sign('identity-service', claims)}`);
    return body === undefined ? pending : pending.send(body);
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
   * Stores a verified account with the password of the run, as the migrator role.
   *
   * @param name - Its first name, for a unique address.
   * @returns Its id and address.
   */
  async function seedAccount(name: string): Promise<{ userId: string; email: string }> {
    accounts += 1;
    const email = `${name.toLowerCase()}.${String(accounts)}@ateliernord.fr`;
    const rows = await migrator.query<{ id: string }>(
      `insert into users (email, name, email_verified_at, version)
       values ($1, $2, now(), 2) returning id`,
      [email, `${name} Martin`],
    );
    const userId = rows.rows[0]?.id ?? '';
    await migrator.query(
      'insert into password_credentials (user_id, password_hash) values ($1, $2)',
      [userId, passwordHash],
    );
    return { userId, email };
  }

  /**
   * Signs an address in with a password from a browser.
   *
   * @param email - The address.
   * @param secret - The password.
   * @param browser - The browser.
   * @returns The response.
   */
  async function passwordSignIn(
    email: string,
    secret: string = password,
    browser: { readonly ipAddress: string; readonly userAgent: string } = firefox,
  ): Promise<Response> {
    const response = await call('post', '/internal/v1/auth/sign-in', anonymous, {
      email,
      password: secret,
      client: browser,
    });
    const token = (response.body as { token?: unknown }).token;
    if (typeof token === 'string') {
      secrets.push(token);
    }
    return response;
  }

  /**
   * Signs a stored account in and returns its session.
   *
   * @param account - The account.
   * @param browser - The browser.
   * @returns The signed-in person.
   */
  async function signIn(
    account: { readonly userId: string; readonly email: string },
    browser: { readonly ipAddress: string; readonly userAgent: string } = firefox,
  ): Promise<SignedIn> {
    const response = await passwordSignIn(account.email, password, browser);
    expect(response.status).toBe(200);
    const body = response.body as { token: string; session: { id: string } };
    return { ...account, sessionId: body.session.id, token: body.token };
  }

  /**
   * Introspects a session token.
   *
   * @param token - The token.
   * @returns Whether the session is active.
   */
  async function isActive(token: string): Promise<boolean> {
    const response = await call('post', '/internal/v1/tokens/introspect', system, { token });
    return (response.body as { active: boolean }).active;
  }

  /**
   * Moves the recent authentication of a session back by 11 minutes, out of its window.
   *
   * @param sessionId - The session.
   */
  async function staleAuthentication(sessionId: string): Promise<void> {
    await systemQuery(
      `update sessions set authenticated_at = authenticated_at - interval '11 minutes'
        where id = $1`,
      [sessionId],
    );
  }

  /**
   * Registers a live membership and seeds the copy, as the member events would.
   *
   * @param userId - The member.
   * @param role - Its role.
   * @param organizationId - The organization.
   * @param memberId - Its id.
   * @returns The id of the membership.
   */
  async function seedMembership(
    userId: string,
    role: SearchMembership['role'],
    organizationId: string = atelierNord,
    memberId: string = randomUUID(),
  ): Promise<string> {
    await systemQuery(
      `insert into memberships (id, organization_id, user_id, role, version)
       values ($1, $2, $3, $4, 1)`,
      [memberId, organizationId, userId, role],
    );
    membershipProofs.set(`${organizationId}/${userId}`, { memberId, role, version: 1 });
    return memberId;
  }

  /**
   * Reads the payloads of the outbox rows of an event, oldest first.
   *
   * @param name - The event.
   * @returns The payloads.
   */
  async function events(name: string): Promise<Record<string, unknown>[]> {
    const rows = await systemQuery<{ payload: Record<string, unknown> }>(
      `select payload from outbox_events where event_name = $1 order by created_at, id`,
      [name],
    );
    return rows.map(({ payload }) => payload);
  }

  /**
   * Wakes the relay until every outbox row of an event is published.
   *
   * @param name - The event.
   */
  async function published(name: string): Promise<void> {
    await vi.waitFor(
      async () => {
        app.get(OutboxRelay).wake();
        const pending = await systemQuery<{ count: number }>(
          `select count(*)::int as count from outbox_events
            where event_name = $1 and status <> 'sent'`,
          [name],
        );
        expect(pending).toEqual([{ count: 0 }]);
      },
      { timeout: 15_000, interval: 100 },
    );
  }

  /**
   * Reads the reset token of the latest link of an account from `EVENTS_RESTRICTED`.
   *
   * @param userId - The account.
   * @returns The token.
   */
  async function latestResetToken(userId: string): Promise<string> {
    const rows = await migrator.query<{ id: string }>(
      `select id from password_reset_links where user_id = $1
        order by created_at desc, id desc limit 1`,
      [userId],
    );
    const linkId = rows.rows[0]?.id;
    await published('password-reset-link.issued.v1');
    const message = restrictedMessages('restricted.password-reset-link.issued.v1').find(
      (payload) => payload.linkId === linkId,
    );
    const token = message?.token;
    if (typeof token !== 'string') {
      throw new Error('The reset link is not in EVENTS_RESTRICTED.');
    }
    secrets.push(token);
    return token;
  }

  /**
   * Reads the latest code of a purpose of an account from `EVENTS_RESTRICTED`.
   *
   * @param userId - The account.
   * @param purpose - The purpose.
   * @returns The payload of the message.
   */
  async function latestCode(userId: string, purpose: string): Promise<Record<string, unknown>> {
    const rows = await migrator.query<{ id: string }>(
      `select id from one_time_codes where user_id = $1 and purpose = $2
        order by created_at desc, id desc limit 1`,
      [userId, purpose],
    );
    const codeId = rows.rows[0]?.id;
    await published('one-time-code.issued.v1');
    const message = restrictedMessages('restricted.one-time-code.issued.v1').find(
      (payload) => payload.codeId === codeId,
    );
    if (message === undefined || typeof message.code !== 'string') {
      throw new Error('The code is not in EVENTS_RESTRICTED.');
    }
    secrets.push(message.code);
    return message;
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
    passwordHash = await hasher.hash(password);

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
      JSON.stringify({ 'api-gateway': [apiGateway.publicJwk] }),
    );
    vi.stubEnv('PASSWORD_PEPPER', pepper);
    vi.stubEnv('WEBAUTHN_RP_ID', 'app.cadenway.localhost');
    vi.stubEnv('WEBAUTHN_ORIGINS', 'http://app.cadenway.localhost');
    organizationAuthority = await startOrganizationMembershipAuthority(
      findMembershipProof,
      reserveAtOrganization,
    );
    vi.stubEnv('ORGANIZATION_SERVICE_URL', organizationAuthority.origin);
    vi.stubEnv('IDENTITY_SERVICE_INTERNAL_TOKEN_PRIVATE_JWK', organizationAuthority.privateJwk);

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
  });

  afterAll(async () => {
    try {
      await app.close();
      await migrator.end();
    } finally {
      try {
        await organizationAuthority?.close();
      } finally {
        vi.unstubAllEnvs();
        compose('down', '--volumes', '--remove-orphans');
      }
    }
  });

  describe('POST /internal/v1/sessions/{sessionId}/reauthentication', () => {
    it('opens a window of 10 minutes for the right password', async () => {
      const camille = await signIn(await seedAccount('Camille'));
      await staleAuthentication(camille.sessionId);
      const before = Date.now();

      const response = await call(
        'post',
        `/internal/v1/sessions/${camille.sessionId}/reauthentication`,
        user(camille.userId),
        { password },
      );

      expect(response.status).toBe(200);
      const body = ReauthenticateInternalResponse.parse(response.body);
      expect(Date.parse(body.authenticatedAt)).toBeGreaterThanOrEqual(before - 1000);
      expect(Date.parse(body.expiresAt) - Date.parse(body.authenticatedAt)).toBe(10 * 60_000);
    });

    it('refuses a wrong password with the attempts left, and the session of another user', async () => {
      const camille = await signIn(await seedAccount('Camille'));
      const ines = await signIn(await seedAccount('Ines'));

      const wrong = await call(
        'post',
        `/internal/v1/sessions/${camille.sessionId}/reauthentication`,
        user(camille.userId),
        { password: 'not-the-password-of-camille' },
      );
      const foreign = await call(
        'post',
        `/internal/v1/sessions/${ines.sessionId}/reauthentication`,
        user(camille.userId),
        { password },
      );

      expect(wrong.status).toBe(422);
      expect(wrong.body).toMatchObject({
        code: 'auth.password-incorrect',
        details: { remainingAttempts: 4 },
      });
      expect(foreign.status).toBe(404);
      expect(foreign.body).toMatchObject({ code: 'session.not-found' });
      expect(await isActive(camille.token)).toBe(true);
    });
  });

  describe('the lockout shared with the sign-in', () => {
    it('counts the failed passwords of the re-authentication and the change with the sign-ins', async () => {
      const account = await seedAccount('Lucas');
      const lucas = await signIn(account);
      for (let attempt = 0; attempt < 2; attempt += 1) {
        expect((await passwordSignIn(account.email, 'not-the-password-of-lucas')).status).toBe(422);
      }
      const third = await call(
        'post',
        `/internal/v1/sessions/${lucas.sessionId}/reauthentication`,
        user(lucas.userId),
        { password: 'not-the-password-of-lucas' },
      );
      const fourth = await call(
        'put',
        `/internal/v1/users/${lucas.userId}/password`,
        user(lucas.userId),
        {
          sessionId: lucas.sessionId,
          currentPassword: 'not-the-password-of-lucas',
          newPassword,
          client: firefox,
        },
      );
      const fifth = await passwordSignIn(account.email, 'not-the-password-of-lucas');
      const locked = await call(
        'post',
        `/internal/v1/sessions/${lucas.sessionId}/reauthentication`,
        user(lucas.userId),
        { password },
      );

      expect(third.body).toMatchObject({ details: { remainingAttempts: 2 } });
      expect(fourth.body).toMatchObject({
        code: 'auth.password-incorrect',
        details: { remainingAttempts: 1 },
      });
      expect(fifth.status).toBe(429);
      expect(locked.status).toBe(429);
      expect(locked.body).toMatchObject({ code: 'auth.account-locked' });
      expect(Number(locked.headers['retry-after'])).toBeGreaterThan(14 * 60);
      expect(await isActive(lucas.token)).toBe(true);
    });
  });

  describe('PUT /internal/v1/users/{userId}/password', () => {
    it('checks the new password first, without counting an attempt', async () => {
      const camille = await signIn(await seedAccount('Camille'));

      const short = await call(
        'put',
        `/internal/v1/users/${camille.userId}/password`,
        user(camille.userId),
        {
          sessionId: camille.sessionId,
          currentPassword: 'not-the-password-of-camille',
          newPassword: 'court-11car',
          client: firefox,
        },
      );
      secrets.push('court-11car');
      const attempts = await migrator.query<{ failed_attempts: number }>(
        'select failed_attempts from sign_in_attempts where email = $1',
        [camille.email],
      );

      expect(short.status).toBe(422);
      expect(short.body).toMatchObject({
        code: 'auth.password-too-short',
        details: { minLength: 12 },
      });
      expect(attempts.rows).toEqual([{ failed_attempts: 0 }]);
    });

    it('refuses another account and a session that is not one of the actor', async () => {
      const camille = await signIn(await seedAccount('Camille'));
      const ines = await signIn(await seedAccount('Ines'));
      const body = { currentPassword: password, newPassword, client: firefox };

      const other = await call(
        'put',
        `/internal/v1/users/${ines.userId}/password`,
        user(camille.userId),
        {
          ...body,
          sessionId: camille.sessionId,
        },
      );
      const foreign = await call(
        'put',
        `/internal/v1/users/${camille.userId}/password`,
        user(camille.userId),
        {
          ...body,
          sessionId: ines.sessionId,
        },
      );

      expect(other.status).toBe(404);
      expect(other.body).toMatchObject({ code: 'user.not-found' });
      expect(foreign.status).toBe(404);
      expect(foreign.body).toMatchObject({ code: 'session.not-found' });
    });

    it('changes the password, keeps the other sessions and ends their recent authentication', async () => {
      const account = await seedAccount('Camille');
      const here = await signIn(account);
      const there = await signIn(account, iphone);
      await staleAuthentication(here.sessionId);

      const response = await call(
        'put',
        `/internal/v1/users/${here.userId}/password`,
        user(here.userId),
        {
          sessionId: here.sessionId,
          currentPassword: password,
          newPassword,
          client: firefox,
        },
      );

      expect(response.status).toBe(200);
      const body = ChangePasswordInternalResponse.parse(response.body);
      expect(body.version).toBe(3);
      expect(response.headers.etag).toBe('"3"');
      expect(Date.now() - Date.parse(body.passwordChangedAt ?? '')).toBeLessThan(60_000);
      expect(await isActive(here.token)).toBe(true);
      expect(await isActive(there.token)).toBe(true);
      expect((await passwordSignIn(account.email)).status).toBe(422);
      expect((await passwordSignIn(account.email, newPassword)).status).toBe(200);
      const here2 = await call(
        'post',
        `/internal/v1/users/${here.userId}/email-change`,
        user(here.userId),
        {
          sessionId: here.sessionId,
          email: `nouvelle.${here.email}`,
        },
      );
      const there2 = await call(
        'post',
        `/internal/v1/users/${there.userId}/email-change`,
        user(there.userId),
        {
          sessionId: there.sessionId,
          email: `autre.${there.email}`,
        },
      );
      expect(here2.status).toBe(202);
      expect(there2.status).toBe(403);
      expect(there2.body).toMatchObject({
        code: 'auth.reauthentication-required',
        details: { methods: ['password'] },
      });
      expect((await events('user.password-changed.v1')).at(-1)).toMatchObject({
        organizationId: null,
        actor: { type: 'user', id: here.userId },
        version: 3,
        userId: here.userId,
        method: 'change',
        closedSessionCount: 0,
        client: {
          device: {
            type: 'desktop',
            browser: 'Firefox',
            browserVersion: '132',
            os: 'Windows',
            osVersion: null,
          },
          ipAddress: firefox.ipAddress,
        },
        recipient: { email: here.email, name: 'Camille Martin' },
        language: 'fr',
        timeZone: 'Europe/Paris',
      });
    });

    it('drops a pending change of address', async () => {
      const camille = await signIn(await seedAccount('Camille'));
      expect(
        (
          await call(
            'post',
            `/internal/v1/users/${camille.userId}/email-change`,
            user(camille.userId),
            {
              sessionId: camille.sessionId,
              email: `pendante.${camille.email}`,
            },
          )
        ).status,
      ).toBe(202);
      const code = (await latestCode(camille.userId, 'email-change')).code as string;

      await call('put', `/internal/v1/users/${camille.userId}/password`, user(camille.userId), {
        sessionId: camille.sessionId,
        currentPassword: password,
        newPassword,
        client: firefox,
      });
      const confirmation = await call(
        'post',
        `/internal/v1/users/${camille.userId}/email-change/confirmation`,
        user(camille.userId),
        { sessionId: camille.sessionId, code, client: firefox },
      );

      expect(confirmation.status).toBe(422);
    });
  });

  describe('the password reset', () => {
    it('answers the same way for an address without an account and for an unverified one', async () => {
      const unverified = `en-attente.${String(Date.now())}@ateliernord.fr`;
      await migrator.query('insert into users (email, name) values ($1, $2)', [
        unverified,
        'Hugo Dupont',
      ]);

      for (const email of [`personne.${String(Date.now())}@ateliernord.fr`, unverified]) {
        const response = await call('post', '/internal/v1/auth/password-reset', anonymous, {
          email,
          client: firefox,
        });
        expect(response.status).toBe(202);
        const body = RequestPasswordResetInternalResponse.parse(response.body);
        expect(body.email).toBe(email);
        expect(Date.parse(body.expiresAt) - Date.now()).toBeGreaterThan(29 * 60_000);
        expect(Date.parse(body.resendAvailableAt) - Date.now()).toBeGreaterThan(40_000);
      }
      const links = await migrator.query(
        `select password_reset_links.id from password_reset_links
           join users on users.id = password_reset_links.user_id where users.email = $1`,
        [unverified],
      );
      expect(links.rows).toEqual([]);
    });

    it('issues a link on the restricted subject only, stored as its hash, redacted once sent', async () => {
      const camille = await seedAccount('Camille');

      const response = await call('post', '/internal/v1/auth/password-reset', anonymous, {
        email: camille.email.toUpperCase(),
        client: firefox,
      });
      const token = await latestResetToken(camille.userId);

      expect(response.status).toBe(202);
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
      const stored = await migrator.query<{ token_hash: string }>(
        'select token_hash from password_reset_links where user_id = $1',
        [camille.userId],
      );
      expect(stored.rows[0]?.token_hash).toMatch(/^[0-9a-f]{64}$/u);
      expect(JSON.stringify(stored.rows)).not.toContain(token);
      const message = restrictedMessages('restricted.password-reset-link.issued.v1').find(
        (payload) => payload.token === token,
      );
      expect(message).toMatchObject({
        organizationId: null,
        actor: { type: 'system', id: 'identity-service' },
        version: 1,
        userId: camille.userId,
        client: { device: { browser: 'Firefox', os: 'Windows' }, ipAddress: firefox.ipAddress },
        recipient: { email: camille.email, name: 'Camille Martin' },
        language: 'fr',
        timeZone: 'Europe/Paris',
      });
      const outbox = await systemQuery<{ payload: Record<string, unknown> }>(
        `select payload from outbox_events where event_name = 'password-reset-link.issued.v1'`,
      );
      expect(JSON.stringify(outbox)).not.toContain(token);
      expect(outbox.every(({ payload }) => payload.$redacted === true)).toBe(true);
      expect(Object.keys(streamSubjects('EVENTS'))).not.toContain(
        'evt.password-reset-link.issued.v1',
      );
    });

    it('throttles the address for 45 seconds, and a new link replaces the previous one', async () => {
      const camille = await seedAccount('Camille');
      await call('post', '/internal/v1/auth/password-reset', anonymous, {
        email: camille.email,
        client: firefox,
      });
      const first = await latestResetToken(camille.userId);

      const throttled = await call('post', '/internal/v1/auth/password-reset', anonymous, {
        email: camille.email,
        client: firefox,
      });
      await migrator.query(
        `update password_reset_requests set last_requested_at = last_requested_at - interval '46 seconds'
          where email = $1`,
        [camille.email],
      );
      const again = await call('post', '/internal/v1/auth/password-reset', anonymous, {
        email: camille.email,
        client: firefox,
      });
      const second = await latestResetToken(camille.userId);

      expect(throttled.status).toBe(429);
      expect(throttled.body).toMatchObject({ code: 'auth.reset-throttled' });
      expect(Number(throttled.headers['retry-after'])).toBeGreaterThan(40);
      expect(again.status).toBe(202);
      expect(second).not.toBe(first);
      const old = await call('post', '/internal/v1/auth/password-reset/inspection', anonymous, {
        token: first,
      });
      expect(old.status).toBe(422);
      expect(old.body).toMatchObject({ code: 'auth.reset-link-expired' });
    });

    it('reads the account of a link without using it, and refuses a malformed or expired one', async () => {
      const account = await seedAccount('Camille');
      await signIn(account);
      await signIn(account, iphone);
      await call('post', '/internal/v1/auth/password-reset', anonymous, {
        email: account.email,
        client: firefox,
      });
      const token = await latestResetToken(account.userId);

      const read = await call('post', '/internal/v1/auth/password-reset/inspection', anonymous, {
        token,
      });
      const again = await call('post', '/internal/v1/auth/password-reset/inspection', anonymous, {
        token,
      });
      const malformed = await call(
        'post',
        '/internal/v1/auth/password-reset/inspection',
        anonymous,
        {
          token: 'not-a-token',
        },
      );
      await migrator.query(
        `update password_reset_links set expires_at = now() - interval '1 second' where user_id = $1`,
        [account.userId],
      );
      const expired = await call('post', '/internal/v1/auth/password-reset/inspection', anonymous, {
        token,
      });

      expect(read.status).toBe(200);
      expect(InspectPasswordResetLinkInternalResponse.parse(read.body)).toMatchObject({
        email: account.email,
        sessionCount: 2,
      });
      expect(again.status).toBe(200);
      expect(malformed.status).toBe(422);
      expect(malformed.body).toMatchObject({ code: 'auth.reset-link-expired' });
      expect(expired.status).toBe(422);
    });

    it('sets the new password once, closes the sessions, ends the lockout, and never signs in', async () => {
      const account = await seedAccount('Camille');
      const here = await signIn(account);
      const there = await signIn(account, iphone);
      await passwordSignIn(account.email, 'not-the-password-of-camille');
      await call('post', '/internal/v1/auth/password-reset', anonymous, {
        email: account.email,
        client: chrome,
      });
      const token = await latestResetToken(account.userId);
      const revokedBefore = (await events('session.revoked.v1')).length;

      const short = await call('post', '/internal/v1/auth/password-reset/confirmation', anonymous, {
        token,
        newPassword: 'court-11car',
        client: chrome,
      });
      const response = await call(
        'post',
        '/internal/v1/auth/password-reset/confirmation',
        anonymous,
        {
          token,
          newPassword,
          client: chrome,
        },
      );
      const reused = await call(
        'post',
        '/internal/v1/auth/password-reset/confirmation',
        anonymous,
        {
          token,
          newPassword,
          client: chrome,
        },
      );

      expect(short.status).toBe(422);
      expect(short.body).toMatchObject({ code: 'auth.password-too-short' });
      expect(response.status).toBe(200);
      expect(ConfirmPasswordResetInternalResponse.parse(response.body)).toEqual({
        email: account.email,
        closedSessionCount: 2,
      });
      expect(response.body).not.toHaveProperty('token');
      expect(reused.status).toBe(422);
      expect(await isActive(here.token)).toBe(false);
      expect(await isActive(there.token)).toBe(false);
      expect((await events('session.revoked.v1')).length - revokedBefore).toBe(2);
      const attempts = await migrator.query<{ failed_attempts: number }>(
        'select failed_attempts from sign_in_attempts where email = $1',
        [account.email],
      );
      expect(attempts.rows).toEqual([{ failed_attempts: 0 }]);
      expect((await events('user.password-changed.v1')).at(-1)).toMatchObject({
        userId: account.userId,
        actor: { type: 'user', id: account.userId },
        method: 'reset',
        closedSessionCount: 2,
        client: { device: { browser: 'Chrome', os: 'macOS', osVersion: null } },
      });
      expect((await passwordSignIn(account.email, newPassword)).status).toBe(200);
    });

    it('uses a link once when two confirmations of it overlap', async () => {
      const account = await seedAccount('Camille');
      await call('post', '/internal/v1/auth/password-reset', anonymous, {
        email: account.email,
        client: firefox,
      });
      const token = await latestResetToken(account.userId);
      const changedBefore = (await events('user.password-changed.v1')).length;

      const answers = await Promise.all(
        [newPassword, 'nord-atelier-sprint-16'].map((candidate) =>
          call('post', '/internal/v1/auth/password-reset/confirmation', anonymous, {
            token,
            newPassword: candidate,
            client: firefox,
          }),
        ),
      );
      secrets.push('nord-atelier-sprint-16');

      expect(answers.map((answer) => answer.status).sort()).toEqual([200, 422]);
      expect(answers.find((answer) => answer.status === 422)?.body).toMatchObject({
        code: 'auth.reset-link-expired',
      });
      const versions = await migrator.query<{ version: number; used: number }>(
        `select users.version,
                (select count(*)::int from password_reset_links
                  where user_id = users.id and used_at is not null) as used
           from users where id = $1`,
        [account.userId],
      );
      expect(versions.rows).toEqual([{ version: 3, used: 1 }]);
      expect((await events('user.password-changed.v1')).length - changedBefore).toBe(1);
    });

    it('leaves the sessions open when asked, without their recent authentication', async () => {
      const account = await seedAccount('Camille');
      const here = await signIn(account);
      await call('post', '/internal/v1/auth/password-reset', anonymous, {
        email: account.email,
        client: firefox,
      });
      const token = await latestResetToken(account.userId);

      const response = await call(
        'post',
        '/internal/v1/auth/password-reset/confirmation',
        anonymous,
        {
          token,
          newPassword,
          closeOtherSessions: false,
          client: firefox,
        },
      );
      const guarded = await call(
        'post',
        `/internal/v1/users/${here.userId}/email-change`,
        user(here.userId),
        {
          sessionId: here.sessionId,
          email: `nouvelle.${here.email}`,
        },
      );

      expect(response.body).toEqual({ email: account.email, closedSessionCount: 0 });
      expect(await isActive(here.token)).toBe(true);
      expect(guarded.status).toBe(403);
    });
  });

  describe('the sessions of a person', () => {
    it('lists the open sessions with their device, address, activity and the current one', async () => {
      const account = await seedAccount('Camille');
      const first = await signIn(account);
      const second = await signIn(account, iphone);
      const ended = await signIn(account, chrome);
      await call('delete', `/internal/v1/sessions/${ended.sessionId}`, user(account.userId));

      const response = await call(
        'get',
        `/internal/v1/users/${account.userId}/sessions?currentSessionId=${first.sessionId}`,
        user(account.userId),
      );

      expect(response.status).toBe(200);
      const page = ListUserSessionsInternalResponse.parse(response.body);
      expect(page.nextCursor).toBeNull();
      expect(page.items.map((item) => item.id)).toEqual([second.sessionId, first.sessionId]);
      expect(page.items[0]).toMatchObject({
        current: false,
        device: {
          type: 'mobile',
          browser: 'Safari',
          browserVersion: '18',
          os: 'iOS',
          osVersion: '18.1',
        },
        ipAddress: iphone.ipAddress,
      });
      expect(page.items[1]).toMatchObject({
        current: true,
        device: {
          type: 'desktop',
          browser: 'Firefox',
          browserVersion: '132',
          os: 'Windows',
          osVersion: null,
        },
        ipAddress: firefox.ipAddress,
      });
    });

    it('pages the list with a cursor and refuses one of another list', async () => {
      const account = await seedAccount('Camille');
      const first = await signIn(account);
      await signIn(account, iphone);

      const one = await call(
        'get',
        `/internal/v1/users/${account.userId}/sessions?currentSessionId=${first.sessionId}&limit=1`,
        user(account.userId),
      );
      const cursor = (one.body as { nextCursor: string }).nextCursor;
      const two = await call(
        'get',
        `/internal/v1/users/${account.userId}/sessions?currentSessionId=${first.sessionId}&limit=1&cursor=${encodeURIComponent(cursor)}`,
        user(account.userId),
      );
      const invalid = await call(
        'get',
        `/internal/v1/users/${account.userId}/sessions?currentSessionId=${first.sessionId}&cursor=nope`,
        user(account.userId),
      );

      expect((one.body as { items: unknown[] }).items).toHaveLength(1);
      expect(cursor).toEqual(expect.any(String));
      expect(two.body).toMatchObject({
        items: [{ id: first.sessionId, current: true }],
        nextCursor: null,
      });
      expect(invalid.status).toBe(400);
      expect(invalid.body).toMatchObject({ code: 'request.invalid' });
    });

    it('refuses another account and a session of the request that ended', async () => {
      const camille = await signIn(await seedAccount('Camille'));
      const ines = await signIn(await seedAccount('Ines'));
      const ended = await signIn({ userId: camille.userId, email: camille.email });
      await call('delete', `/internal/v1/sessions/${ended.sessionId}`, user(camille.userId));

      const other = await call(
        'get',
        `/internal/v1/users/${ines.userId}/sessions?currentSessionId=${ines.sessionId}`,
        user(camille.userId),
      );
      const gone = await call(
        'get',
        `/internal/v1/users/${camille.userId}/sessions?currentSessionId=${ended.sessionId}`,
        user(camille.userId),
      );

      expect(other.status).toBe(404);
      expect(other.body).toMatchObject({ code: 'user.not-found' });
      expect(gone.status).toBe(404);
      expect(gone.body).toMatchObject({ code: 'session.not-found' });
    });

    it('revokes every other session, each with its event, and keeps the current one', async () => {
      const account = await seedAccount('Camille');
      const here = await signIn(account);
      const there = await signIn(account, iphone);
      const elsewhere = await signIn(account, chrome);
      const revokedBefore = (await events('session.revoked.v1')).length;

      const response = await call(
        'post',
        `/internal/v1/sessions/${here.sessionId}/revoke-others`,
        user(account.userId),
      );
      const foreign = await call(
        'post',
        `/internal/v1/sessions/${here.sessionId}/revoke-others`,
        user((await seedAccount('Ines')).userId),
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ revokedCount: 2 });
      expect(await isActive(here.token)).toBe(true);
      expect(await isActive(there.token)).toBe(false);
      expect(await isActive(elsewhere.token)).toBe(false);
      expect((await events('session.revoked.v1')).length - revokedBefore).toBe(2);
      expect(foreign.status).toBe(404);
      expect(foreign.body).toMatchObject({ code: 'session.not-found' });
    });

    it('keeps one session when two devices sign the others out at once, without a deadlock', async () => {
      const account = await seedAccount('Camille');
      const here = await signIn(account);
      const there = await signIn(account, iphone);
      const elsewhere = await signIn(account, chrome);
      const revokedBefore = (await events('session.revoked.v1')).length;

      const answers = await Promise.all(
        [here, there].map((session) =>
          call(
            'post',
            `/internal/v1/sessions/${session.sessionId}/revoke-others`,
            user(account.userId),
          ),
        ),
      );

      expect(answers.map((answer) => answer.status).sort()).toEqual([200, 404]);
      expect(answers.find((answer) => answer.status === 200)?.body).toEqual({ revokedCount: 2 });
      const active = await Promise.all(
        [here, there, elsewhere].map((session) => isActive(session.token)),
      );
      expect(active.filter(Boolean)).toHaveLength(1);
      expect(active[2]).toBe(false);
      expect((await events('session.revoked.v1')).length - revokedBefore).toBe(2);
    });
  });

  describe('the change of address', () => {
    it('refuses without a recent authentication, the current address, and a verified one', async () => {
      const camille = await signIn(await seedAccount('Camille'));
      const ines = await seedAccount('Ines');
      const pending = `en-attente.${String(Date.now())}@ateliernord.fr`;
      await migrator.query('insert into users (email, name) values ($1, $2)', [
        pending,
        'Hugo Dupont',
      ]);
      const path = `/internal/v1/users/${camille.userId}/email-change`;

      const unchanged = await call('post', path, user(camille.userId), {
        sessionId: camille.sessionId,
        email: camille.email.toUpperCase(),
      });
      const taken = await call('post', path, user(camille.userId), {
        sessionId: camille.sessionId,
        email: ines.email,
      });
      const free = await call('post', path, user(camille.userId), {
        sessionId: camille.sessionId,
        email: pending,
      });
      const throttled = await call('post', path, user(camille.userId), {
        sessionId: camille.sessionId,
        email: pending,
      });
      await staleAuthentication(camille.sessionId);
      const stale = await call('post', path, user(camille.userId), {
        sessionId: camille.sessionId,
        email: camille.email,
      });

      expect(unchanged.status).toBe(422);
      expect(unchanged.body).toMatchObject({ code: 'auth.email-unchanged' });
      expect(taken.status).toBe(409);
      expect(taken.body).toMatchObject({ code: 'auth.email-taken' });
      expect(free.status).toBe(202);
      expect(throttled.status).toBe(429);
      expect(throttled.body).toMatchObject({ code: 'auth.code-throttled' });
      expect(stale.status).toBe(403);
      expect(stale.body).toMatchObject({
        code: 'auth.reauthentication-required',
        details: { methods: ['password'] },
      });
    });

    it('sends the code to the new address and confirms it from the session that asked only', async () => {
      const account = await seedAccount('Camille');
      const here = await signIn(account);
      const there = await signIn(account, iphone);
      const newEmail = `camille.${String(Date.now())}@ateliernord.fr`;
      const pendingSignUp = newEmail;
      await migrator.query('insert into users (email, name) values ($1, $2)', [
        pendingSignUp,
        'Hugo Dupont',
      ]);
      await call('post', '/internal/v1/auth/password-reset', anonymous, {
        email: account.email,
        client: firefox,
      });
      const resetToken = await latestResetToken(account.userId);

      const requested = await call(
        'post',
        `/internal/v1/users/${account.userId}/email-change`,
        user(account.userId),
        {
          sessionId: here.sessionId,
          email: newEmail,
        },
      );
      const message = await latestCode(account.userId, 'email-change');
      const code = message.code as string;
      const elsewhere = await call(
        'post',
        `/internal/v1/users/${account.userId}/email-change/confirmation`,
        user(account.userId),
        { sessionId: there.sessionId, code, client: iphone },
      );
      const wrong = await call(
        'post',
        `/internal/v1/users/${account.userId}/email-change/confirmation`,
        user(account.userId),
        {
          sessionId: here.sessionId,
          code: code === '000000' ? '111111' : '000000',
          client: firefox,
        },
      );
      const confirmed = await call(
        'post',
        `/internal/v1/users/${account.userId}/email-change/confirmation`,
        user(account.userId),
        { sessionId: here.sessionId, code, client: firefox },
      );

      expect(requested.status).toBe(202);
      expect(requested.body).toMatchObject({ email: newEmail });
      expect(message).toMatchObject({
        purpose: 'email-change',
        actor: { type: 'user', id: account.userId },
        recipient: { email: newEmail, name: 'Camille Martin' },
      });
      expect(Date.parse(message.expiresAt as string) - Date.now()).toBeGreaterThan(14 * 60_000);
      expect(elsewhere.status).toBe(422);
      expect(elsewhere.body).toMatchObject({ code: 'auth.code-invalid' });
      expect(wrong.status).toBe(422);
      expect(confirmed.status).toBe(200);
      expect(confirmed.body).toMatchObject({ email: newEmail, version: 3 });
      expect(confirmed.headers.etag).toBe('"3"');
      expect(await isActive(here.token)).toBe(true);
      expect(await isActive(there.token)).toBe(true);
      expect((await passwordSignIn(account.email)).status).toBe(422);
      expect((await passwordSignIn(newEmail)).status).toBe(200);
      const replacedSignUp = await migrator.query('select id from users where email = $1', [
        newEmail,
      ]);
      expect(replacedSignUp.rows).toEqual([{ id: account.userId }]);
      const reset = await call('post', '/internal/v1/auth/password-reset/inspection', anonymous, {
        token: resetToken,
      });
      expect(reset.status).toBe(422);
      expect((await events('user.email-changed.v1')).at(-1)).toMatchObject({
        organizationId: null,
        actor: { type: 'user', id: account.userId },
        version: 3,
        userId: account.userId,
        email: newEmail,
        previousEmail: account.email,
        name: 'Camille Martin',
        client: { device: { browser: 'Firefox' }, ipAddress: firefox.ipAddress },
      });
    });

    it('drops the change when a verified account took the new address since the request', async () => {
      const camille = await signIn(await seedAccount('Camille'));
      const newEmail = `prise.${String(Date.now())}@ateliernord.fr`;
      await call(
        'post',
        `/internal/v1/users/${camille.userId}/email-change`,
        user(camille.userId),
        {
          sessionId: camille.sessionId,
          email: newEmail,
        },
      );
      const code = (await latestCode(camille.userId, 'email-change')).code as string;
      await migrator.query(
        'insert into users (email, name, email_verified_at, version) values ($1, $2, now(), 2)',
        [newEmail, 'Ines Roux'],
      );

      const taken = await call(
        'post',
        `/internal/v1/users/${camille.userId}/email-change/confirmation`,
        user(camille.userId),
        { sessionId: camille.sessionId, code, client: firefox },
      );
      const pending = await migrator.query('select user_id from email_changes where user_id = $1', [
        camille.userId,
      ]);

      expect(taken.status).toBe(409);
      expect(taken.body).toMatchObject({ code: 'auth.email-taken' });
      expect(pending.rows).toEqual([]);
    });
  });

  describe('POST /internal/v1/api-tokens', () => {
    it('requires a recent authentication of the session of the request', async () => {
      const ines = await seedAccount('Ines');
      await seedMembership(ines.userId, 'member');
      const session = await signIn(ines);
      expect(
        (
          await call(
            'put',
            `/internal/v1/sessions/${session.sessionId}/organization`,
            user(ines.userId),
            {
              organizationId: atelierNord,
            },
          )
        ).status,
      ).toBe(200);
      const body = { name: 'Synchronisation GitLab', scopes: ['tasks:read'] };
      const claims = user(ines.userId, atelierNord);

      const missing = await call('post', '/internal/v1/api-tokens', claims, body);
      const foreign = await call('post', '/internal/v1/api-tokens', claims, {
        ...body,
        sessionId: randomUUID(),
      });
      const created = await call('post', '/internal/v1/api-tokens', claims, {
        ...body,
        sessionId: session.sessionId,
      });
      secrets.push((created.body as { secret: string }).secret);
      await staleAuthentication(session.sessionId);
      const stale = await call('post', '/internal/v1/api-tokens', claims, {
        ...body,
        sessionId: session.sessionId,
      });

      expect(missing.status).toBe(403);
      expect(missing.body).toMatchObject({
        code: 'auth.reauthentication-required',
        details: { methods: ['password'] },
      });
      expect(foreign.status).toBe(404);
      expect(foreign.body).toMatchObject({ code: 'session.not-found' });
      expect(created.status).toBe(201);
      expect(stale.status).toBe(403);
      const tokens = await systemQuery<{ count: number }>(
        'select count(*)::int as count from api_tokens where user_id = $1',
        [ines.userId],
      );
      expect(tokens).toEqual([{ count: 1 }]);
    });
  });

  it('introspects both credential types against signed current Organization membership proofs', async () => {
    const camille = await seedAccount('Camille');
    const memberId = '019a6b10-0000-7000-8000-000000000001';
    const newMemberId = '019a6b10-0000-7000-8000-000000000002';
    await seedMembership(camille.userId, 'owner', atelierNord, memberId);
    const session = await signIn(camille);
    const chosen = await call(
      'put',
      `/internal/v1/sessions/${session.sessionId}/organization`,
      user(camille.userId),
      { organizationId: atelierNord },
    );
    expect(chosen.status).toBe(200);
    const created = await call(
      'post',
      '/internal/v1/api-tokens',
      user(camille.userId, atelierNord),
      {
        name: 'Current membership fixture',
        scopes: ['tasks:read'],
        sessionId: session.sessionId,
      },
    );
    expect(created.status).toBe(201);
    const { secret } = created.body as { secret: string };
    secrets.push(secret);

    const introspect = (credential: 'session' | 'api-token'): Promise<Response> =>
      credential === 'session'
        ? call('post', '/internal/v1/tokens/introspect', system, { token: session.token })
        : call('post', '/internal/v1/api-tokens/introspect', system, { token: secret });
    const proofKey = `${atelierNord}/${camille.userId}`;
    findMembershipProof.mockClear();
    membershipProofs.set(proofKey, { memberId, role: 'guest', version: 2 });

    for (const credential of ['session', 'api-token'] as const) {
      const attenuated = await introspect(credential);
      expect(attenuated.status).toBe(200);
      expect(attenuated.body).toMatchObject({ active: true, role: 'guest' });
    }
    membershipProofs.delete(proofKey);
    expect((await introspect('session')).body).toMatchObject({
      active: true,
      organizationId: null,
      role: null,
    });
    expect((await introspect('api-token')).body).toEqual({ active: false });

    membershipProofs.set(proofKey, new Error('Organization is unavailable.'));
    for (const credential of ['session', 'api-token'] as const) {
      const unavailable = await introspect(credential);
      expect(unavailable.status).toBe(503);
      expect(unavailable.body).toMatchObject({ code: 'organization.unavailable' });
    }

    membershipProofs.set(proofKey, { memberId: newMemberId, role: 'member', version: 1 });
    expect((await introspect('session')).body).toMatchObject({
      active: true,
      organizationId: null,
    });
    expect((await introspect('api-token')).body).toMatchObject({
      active: true,
      organizationId: atelierNord,
      role: 'member',
    });

    expect(
      await systemQuery('select organization_id, member_id from sessions where id = $1', [
        session.sessionId,
      ]),
    ).toEqual([{ organization_id: atelierNord, member_id: memberId }]);
    expect(findMembershipProof.mock.calls).toEqual(
      Array.from({ length: 8 }, () => [atelierNord, camille.userId]),
    );
  });

  it.each(['source', 'target'] as const)(
    'keeps the session and last choice when the live %s membership cannot be checked',
    async (unavailable) => {
      const account = await seedAccount('Camille');
      const targetOrganization = randomUUID();
      const sourceMemberId = await seedMembership(account.userId, 'member');
      await seedMembership(account.userId, 'member', targetOrganization);
      const session = await signIn(account);
      const path = `/internal/v1/sessions/${session.sessionId}/organization`;
      const actor = user(account.userId);
      expect((await call('put', path, actor, { organizationId: atelierNord })).status).toBe(200);
      await systemQuery(
        'update sessions set saml_organization_id = $2, saml_member_id = $3 where id = $1',
        [session.sessionId, atelierNord, sourceMemberId],
      );

      const unavailableOrganization = unavailable === 'source' ? atelierNord : targetOrganization;
      membershipProofs.set(
        `${unavailableOrganization}/${account.userId}`,
        new Error('Organization is unavailable.'),
      );
      const selection = `select organization_id, member_id, saml_organization_id, saml_member_id,
                                version from sessions where id = $1`;
      const before = await systemQuery(selection, [session.sessionId]);
      const response = await call('put', path, actor, { organizationId: targetOrganization });

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({ code: 'organization.unavailable' });
      expect(await systemQuery(selection, [session.sessionId])).toEqual(before);
      expect(
        await systemQuery('select organization_id from organization_choices where user_id = $1', [
          account.userId,
        ]),
      ).toEqual([{ organization_id: atelierNord }]);
    },
  );

  describe('the deletion of an account', () => {
    it('refuses an owner first, with its organizations, then a session without a recent authentication', async () => {
      const owner = await signIn(await seedAccount('Camille'));
      const organization = randomUUID();
      await seedMembership(owner.userId, 'owner', organization);
      await staleAuthentication(owner.sessionId);
      const member = await signIn(await seedAccount('Ines'));
      await staleAuthentication(member.sessionId);

      const refusedOwner = await call(
        'post',
        `/internal/v1/users/${owner.userId}/deletion`,
        user(owner.userId),
        {
          sessionId: owner.sessionId,
        },
      );
      const refusedStale = await call(
        'post',
        `/internal/v1/users/${member.userId}/deletion`,
        user(member.userId),
        {
          sessionId: member.sessionId,
        },
      );

      expect(refusedOwner.status).toBe(409);
      expect(refusedOwner.body).toMatchObject({
        code: 'account.organization-owner',
        details: { organizationIds: [organization] },
      });
      expect(refusedStale.status).toBe(403);
      expect(refusedStale.body).toMatchObject({ code: 'auth.reauthentication-required' });
      expect(await isActive(owner.token)).toBe(true);
    });

    it('schedules the deletion in 30 days and revokes every session and token at once', async () => {
      const account = await seedAccount('Ines');
      await seedMembership(account.userId, 'member');
      const here = await signIn(account);
      const there = await signIn(account, iphone);
      const choice = await call(
        'put',
        `/internal/v1/sessions/${here.sessionId}/organization`,
        user(account.userId),
        { organizationId: atelierNord },
      );
      expect(choice.status).toBe(200);
      const created = await call(
        'post',
        '/internal/v1/api-tokens',
        user(account.userId, atelierNord),
        {
          name: 'Synchronisation GitLab',
          scopes: ['tasks:read'],
          sessionId: here.sessionId,
        },
      );
      expect(created.status).toBe(201);
      const secret = (created.body as { secret: string }).secret;
      secrets.push(secret);
      const before = Date.now();

      const response = await call(
        'post',
        `/internal/v1/users/${account.userId}/deletion`,
        user(account.userId),
        {
          sessionId: here.sessionId,
        },
      );

      expect(response.status).toBe(202);
      const body = ScheduleAccountDeletionInternalResponse.parse(response.body);
      expect(Date.parse(body.deleteAt) - before).toBeGreaterThan(29.9 * 24 * 60 * 60_000);
      expect(await isActive(here.token)).toBe(false);
      expect(await isActive(there.token)).toBe(false);
      const introspected = await call('post', '/internal/v1/api-tokens/introspect', system, {
        token: secret,
      });
      expect(introspected.body).toEqual({ active: false });
      expect((await events('user.deletion-scheduled.v1')).at(-1)).toMatchObject({
        actor: { type: 'user', id: account.userId },
        version: 3,
        userId: account.userId,
        deleteAt: body.deleteAt,
        recipient: { email: account.email, name: 'Ines Martin' },
      });
    });

    it('rolls the scheduling back, sessions and tokens included, when its event cannot be written', async () => {
      const account = await seedAccount('Ines');
      await seedMembership(account.userId, 'member');
      const here = await signIn(account);
      const choice = await call(
        'put',
        `/internal/v1/sessions/${here.sessionId}/organization`,
        user(account.userId),
        { organizationId: atelierNord },
      );
      expect(choice.status).toBe(200);
      const created = await call(
        'post',
        '/internal/v1/api-tokens',
        user(account.userId, atelierNord),
        {
          name: 'Synchronisation GitLab',
          scopes: ['tasks:read'],
          sessionId: here.sessionId,
        },
      );
      expect(created.status).toBe(201);
      const secret = (created.body as { secret: string }).secret;
      secrets.push(secret);
      const outbox = app.get(OutboxWriter);
      const append = outbox.append.bind(outbox);
      const failing = vi
        .spyOn(outbox, 'append')
        .mockImplementation((...args: Parameters<OutboxWriter['append']>) =>
          args[2] === 'user.deletion-scheduled.v1'
            ? Promise.reject(new Error('the outbox refuses the row'))
            : append(...args),
        );

      let response: Response;
      try {
        response = await call(
          'post',
          `/internal/v1/users/${account.userId}/deletion`,
          user(account.userId),
          {
            sessionId: here.sessionId,
          },
        );
      } finally {
        failing.mockRestore();
      }

      expect(response.status).toBe(500);
      expect(await isActive(here.token)).toBe(true);
      const introspected = await call('post', '/internal/v1/api-tokens/introspect', system, {
        token: secret,
      });
      expect(introspected.body).toMatchObject({ active: true });
      const stored = await migrator.query<{ delete_at: Date | null; version: number }>(
        'select delete_at, version from users where id = $1',
        [account.userId],
      );
      expect(stored.rows).toEqual([{ delete_at: null, version: 2 }]);
      const revoked = await events('session.revoked.v1');
      expect(revoked.some((payload) => payload.sessionId === here.sessionId)).toBe(false);
    });

    it('cancels the deletion by a sign-in, which tells it in its answer and its event', async () => {
      const account = await seedAccount('Ines');
      const here = await signIn(account);
      await call('post', `/internal/v1/users/${account.userId}/deletion`, user(account.userId), {
        sessionId: here.sessionId,
      });

      const response = await passwordSignIn(account.email, password, iphone);
      const next = await passwordSignIn(account.email);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ deletionCancelled: true, user: { version: 4 } });
      expect(next.body).toMatchObject({ deletionCancelled: false });
      const stored = await migrator.query<{ delete_at: Date | null }>(
        'select delete_at from users where id = $1',
        [account.userId],
      );
      expect(stored.rows).toEqual([{ delete_at: null }]);
      expect((await events('user.deletion-cancelled.v1')).at(-1)).toMatchObject({
        actor: { type: 'user', id: account.userId },
        version: 4,
        userId: account.userId,
        sessionId: (response.body as { session: { id: string } }).session.id,
        client: { device: { type: 'mobile', browser: 'Safari' }, ipAddress: iphone.ipAddress },
      });
    });

    it('deletes the account at deleteAt by its job, and keeps one that owns an organization then', async () => {
      const kept = await seedAccount('Camille');
      const deleted = await seedAccount('Ines');
      const memberId = await seedMembership(deleted.userId, 'member');
      for (const account of [kept, deleted]) {
        const session = await signIn(account);
        expect(
          (
            await call(
              'post',
              `/internal/v1/users/${account.userId}/deletion`,
              user(account.userId),
              {
                sessionId: session.sessionId,
              },
            )
          ).status,
        ).toBe(202);
      }
      const organization = randomUUID();
      // Identity's event-fed copy has not seen this ownership.
      authoritativeOwners.set(kept.userId, [organization]);
      await migrator.query(
        `update users set delete_at = now() - interval '1 minute' where id = any($1::uuid[])`,
        [[kept.userId, deleted.userId]],
      );
      // A previous worker's SQL cannot bypass the authority during cutover or rollback.
      await expect(
        systemQuery('delete from users where id = $1 returning id', [kept.userId]),
      ).rejects.toMatchObject({ code: '23514' });

      await app.get(EnqueueDueAccountDeletions, { strict: false }).execute();
      await vi.waitFor(
        async () => {
          const rows = await migrator.query('select id from users where id = $1', [deleted.userId]);
          expect(rows.rows).toEqual([]);
        },
        { timeout: 30_000, interval: 250 },
      );
      await vi.waitFor(
        async () => {
          const rows = await migrator.query<{ checked: boolean }>(
            `select deletion_checked_at is not null and deletion_attempt_id is null as checked
             from users where id = $1`,
            [kept.userId],
          );
          expect(reserveAtOrganization).toHaveBeenCalledWith(kept.userId, expect.any(String));
          expect(rows.rows).toEqual([{ checked: true }]);
        },
        { timeout: 30_000, interval: 250 },
      );

      const leftovers = await systemQuery<{ sessions: number; tokens: number; codes: number }>(
        `select (select count(*)::int from sessions where user_id = $1) as sessions,
                (select count(*)::int from api_tokens where user_id = $1) as tokens,
                (select count(*)::int from one_time_codes where user_id = $1) as codes`,
        [deleted.userId],
      );
      expect(leftovers).toEqual([{ sessions: 0, tokens: 0, codes: 0 }]);
      const throttles = await migrator.query(
        `select email from sign_in_attempts where email = $1
         union all select email from code_requests where email = $1`,
        [deleted.email],
      );
      expect(throttles.rows).toEqual([]);
      const membership = await systemQuery<{ id: string }>(
        'select id from memberships where id = $1',
        [memberId],
      );
      expect(membership).toEqual([{ id: memberId }]);
      expect(
        (await events('user.deleted.v1')).filter((payload) => payload.userId === deleted.userId),
      ).toEqual([
        expect.objectContaining({
          organizationId: null,
          actor: { type: 'system', id: 'identity-service' },
          version: 4,
          userId: deleted.userId,
        }),
      ]);
      expect(
        (await events('user.deleted.v1')).some((payload) => payload.userId === kept.userId),
      ).toBe(false);

      authoritativeOwners.delete(kept.userId);
      await migrator.query(
        `update users set deletion_checked_at = now() - interval '61 minutes' where id = $1`,
        [kept.userId],
      );
      await app.get(EnqueueDueAccountDeletions, { strict: false }).execute();
      await vi.waitFor(
        async () => {
          const rows = await migrator.query('select id from users where id = $1', [kept.userId]);
          expect(rows.rows).toEqual([]);
        },
        { timeout: 30_000, interval: 250 },
      );
      expect((await passwordSignIn(deleted.email)).status).toBe(422);
      const deletedEvents = (await events('user.deleted.v1')).length;
      await app.get(EnqueueDueAccountDeletions, { strict: false }).execute();
      await expect(
        app.get(CompleteAccountDeletion, { strict: false }).execute({ userId: deleted.userId }),
      ).resolves.toEqual({ outcome: 'not-due' });
      expect((await events('user.deleted.v1')).length).toBe(deletedEvents);
    });

    it('keeps the account and what names it when the event of its deletion cannot be written', async () => {
      const account = await seedAccount('Lea');
      const session = await signIn(account);
      expect(
        (
          await call(
            'post',
            `/internal/v1/users/${account.userId}/deletion`,
            user(account.userId),
            {
              sessionId: session.sessionId,
            },
          )
        ).status,
      ).toBe(202);
      await migrator.query(
        `update users set delete_at = now() - interval '1 minute' where id = $1`,
        [account.userId],
      );
      const outbox = app.get(OutboxWriter);
      const append = outbox.append.bind(outbox);
      const failing = vi
        .spyOn(outbox, 'append')
        .mockImplementation((...args: Parameters<OutboxWriter['append']>) =>
          args[2] === 'user.deleted.v1'
            ? Promise.reject(new Error('the outbox refuses the row'))
            : append(...args),
        );

      try {
        await expect(
          app.get(CompleteAccountDeletion, { strict: false }).execute({ userId: account.userId }),
        ).rejects.toThrow('the outbox refuses the row');
      } finally {
        failing.mockRestore();
      }

      const kept = await systemQuery<{ users: number; sessions: number; version: number }>(
        `select (select count(*)::int from users where id = $1) as users,
                (select count(*)::int from sessions where user_id = $1) as sessions,
                (select version from users where id = $1) as version`,
        [account.userId],
      );
      expect(kept).toEqual([{ users: 1, sessions: 1, version: 3 }]);
      expect(
        (await events('user.deleted.v1')).some((payload) => payload.userId === account.userId),
      ).toBe(false);
      await expect(
        app.get(CompleteAccountDeletion, { strict: false }).execute({ userId: account.userId }),
      ).resolves.toEqual({ outcome: 'deleted' });
    });
  });

  describe('"Nouvelle connexion"', () => {
    it('tells of a device the account did not use in the last 90 days, never of the first session', async () => {
      const email = `hugo.${String(Date.now())}@ateliernord.fr`;
      const signUp = await call('post', '/internal/v1/auth/sign-up', anonymous, {
        name: 'Hugo Dupont',
        email,
        password,
        acceptTerms: true,
      });
      expect(signUp.status).toBe(202);
      const ids = await migrator.query<{ id: string }>('select id from users where email = $1', [
        email,
      ]);
      const userId = ids.rows[0]?.id ?? '';
      const code = (await latestCode(userId, 'email-verification')).code as string;
      const verified = await call('post', '/internal/v1/auth/sign-up/verification', anonymous, {
        email,
        code,
        password,
        client: firefox,
      });
      secrets.push((verified.body as { token: string }).token);
      const told = async (): Promise<number> =>
        (await events('session.opened-on-new-device.v1')).filter(
          (payload) => payload.userId === userId,
        ).length;

      expect(verified.status).toBe(200);
      expect(await told()).toBe(0);
      await passwordSignIn(email);
      expect(await told()).toBe(0);
      const fromPhone = await passwordSignIn(email, password, iphone);
      expect(await told()).toBe(1);
      expect((await events('session.opened-on-new-device.v1')).at(-1)).toMatchObject({
        organizationId: null,
        actor: { type: 'user', id: userId },
        version: 1,
        sessionId: (fromPhone.body as { session: { id: string } }).session.id,
        userId,
        client: {
          device: {
            type: 'mobile',
            browser: 'Safari',
            browserVersion: '18',
            os: 'iOS',
            osVersion: '18.1',
          },
          ipAddress: iphone.ipAddress,
        },
        recipient: { email, name: 'Hugo Dupont' },
        language: 'fr',
        timeZone: 'Europe/Paris',
      });
      await systemQuery(
        `update sessions set last_active_at = last_active_at - interval '91 days' where user_id = $1`,
        [userId],
      );
      await passwordSignIn(email);
      expect(await told()).toBe(2);
      await published('session.opened-on-new-device.v1');
      expect(Object.keys(streamSubjects('EVENTS'))).toContain(
        'evt.session.opened-on-new-device.v1',
      );
    });
  });

  describe('the events of the account', () => {
    it('publishes the security events on evt. and the link and the codes on restricted. only', async () => {
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
      const evt = Object.keys(streamSubjects('EVENTS'));
      const restricted = Object.keys(streamSubjects('EVENTS_RESTRICTED')).sort();

      expect(evt).toEqual(
        expect.arrayContaining([
          'evt.user.password-changed.v1',
          'evt.user.email-changed.v1',
          'evt.user.deletion-scheduled.v1',
          'evt.user.deletion-cancelled.v1',
          'evt.user.deleted.v1',
          'evt.session.opened-on-new-device.v1',
          'evt.session.revoked.v1',
        ]),
      );
      expect(
        evt.some(
          (subject) => subject.includes('password-reset-link') || subject.includes('one-time-code'),
        ),
      ).toBe(false);
      expect(restricted).toEqual([
        'restricted.one-time-code.issued.v1',
        'restricted.password-reset-link.issued.v1',
      ]);
    });
  });

  describe('the logs', () => {
    it('never hold a password, a code, a token or a reset link', () => {
      expect(logLines.length).toBeGreaterThan(50);
      expect(secrets.length).toBeGreaterThan(20);
      const leaks = logLines.filter((line) => secrets.some((secret) => line.includes(secret)));

      expect(leaks).toEqual([]);
    });
  });
});
