import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { userTwoStepVerificationChangedV1Schema } from '@cadenway/contracts/events/identity-service';
import type { SearchMembership } from '@cadenway/contracts/types/internal/organization-service';
import {
  AddSecurityKeyInternalResponse,
  AnswerSignInChallengeWithAuthenticatorAppInternalResponse,
  ConfirmAuthenticatorAppSetupInternalResponse,
  GetSignInChallengeSecurityKeyOptionsInternalResponse,
  GetTwoStepVerificationInternalResponse,
  InspectSignInChallengeInternalResponse,
  StartAuthenticatorAppSetupInternalResponse,
  StartSecurityKeyRegistrationInternalResponse,
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
import { generate } from 'otplib';
import pg from 'pg';
import request from 'supertest';
import type { Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { appConfigSchema } from '../src/config/app-config.js';
import { Argon2PasswordHasher } from '../src/modules/accounts/infrastructure/adapters/security/argon2-password-hasher.adapter.js';
import { SoftwareAuthenticator } from '../src/modules/accounts/infrastructure/adapters/security/software-authenticator.fixture.js';
import { startOrganizationMembershipAuthority } from './support/organization-membership.fixture.js';

// Two-step verification (P2c-2): the setup of an authenticator app and its confirmation, the
// two-step challenge of the sign-ins answered with the app, a backup code or a security key, the
// trusted devices, the lockout of the answers, the re-authentication by code, the disabling and the
// authentication policy of an organization, through HTTP as the API gateway calls them, on the
// service as main.ts assembles it, against a disposable PostgreSQL and NATS started from
// compose.dev.yaml (see service-wiring.int-spec.ts). The codes of the app come from otplib, as an
// app computes them; a code is accepted once per time step, so a scenario that needs another one in
// the same step clears the last accepted step of the account, never waits. The security key is a
// software authenticator of the relying party `app.cadenway.localhost`, answering from the origin
// `http://app.cadenway.localhost` of the local stack, without a network.

/** Compose file of the development dependencies. */
const composeFile: string = fileURLToPath(new URL('../compose.dev.yaml', import.meta.url));

/** Throwaway project name, distinct from the other suites and from any developer stack. */
const project = `cadenway-identity-service-two-step-test-${String(process.pid)}`;

/** A pepper for the run only. */
const pepper = 'integration-test-password-pepper-two-step-verification';

/** The password of the accounts of the run. */
const password = 'atelier-nord-sprint-14';

/** The new password of a change. */
const newPassword = 'nord-atelier-sprint-15';

/** The relying party of the local stack. */
const rpId = 'app.cadenway.localhost';

/** The origin of the web application of the local stack. */
const origin = 'http://app.cadenway.localhost';

/** Every scope of a session. */
const everyScope = ['tasks:read', 'tasks:write', 'members:read', 'webhooks:manage'];

/** Firefox on Windows, the browser of the contract's examples. */
const firefox = {
  ipAddress: '192.0.2.14',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
} as const;

/**
 * Every secret the run handled: passwords, secrets of apps, codes, backup codes, tokens of sessions,
 * of challenges and of trusted devices, WebAuthn answers.
 */
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

/** A person with two-step verification: the secret of the app and the backup codes. */
interface Enrolled extends SignedIn {
  readonly secret: string;
  readonly backupCodes: readonly string[];
}

describe('identity-service two-step verification', () => {
  const apiGateway = keyPair('test-api-gateway');
  const hasher = new Argon2PasswordHasher(pepper);
  let app: NestExpressApplication;
  let gateway: InternalTokenSigner;
  let migrator: pg.Pool;
  let membershipAuthority:
    Awaited<ReturnType<typeof startOrganizationMembershipAuthority>> | undefined;
  const liveRoles = new Map<string, SearchMembership['role']>();
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
   * The claims of a signed-in user, with an organization for the routes that need one.
   *
   * @param userId - Id of the user.
   * @param organizationId - The current organization, or `null`.
   * @returns The claims.
   */
  function user(userId: string, organizationId: string | null = null): InternalTokenClaims {
    return organizationId === null
      ? { actor: { type: 'user', id: userId }, organizationId: null }
      : { actor: { type: 'user', id: userId }, organizationId, role: 'admin', scopes: everyScope };
  }

  /**
   * Sends a request to the service with an internal token of the API gateway.
   *
   * @param method - HTTP method.
   * @param path - Path of the route.
   * @param claims - Claims of the internal token.
   * @param body - Body of the request, if any.
   * @param ifMatch - The `If-Match` header, if any.
   * @returns The response.
   */
  async function call(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    claims: InternalTokenClaims,
    body?: object,
    ifMatch?: string,
  ): Promise<Response> {
    const signed = request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${await gateway.sign('identity-service', claims)}`);
    const pending = ifMatch === undefined ? signed : signed.set('If-Match', ifMatch);
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
   * Stores a membership in the copy, as the member events of organization-service would.
   *
   * @param userId - The member.
   * @param role - Its role.
   * @param organizationId - The organization.
   */
  async function seedMembership(
    userId: string,
    role: 'owner' | 'admin' | 'member' | 'guest',
    organizationId: string,
  ): Promise<void> {
    await systemQuery(
      `insert into memberships (id, organization_id, user_id, role, version)
       values ($1, $2, $3, $4, 1)`,
      [randomUUID(), organizationId, userId, role],
    );
  }

  /**
   * Signs an address in with its password.
   *
   * @param email - The address.
   * @param trustedDeviceToken - The trusted device cookie of the browser, if any.
   * @param secret - The password.
   * @returns The response, `200` or `202`.
   */
  async function passwordSignIn(
    email: string,
    trustedDeviceToken?: string,
    secret: string = password,
  ): Promise<Response> {
    const response = await call('post', '/internal/v1/auth/sign-in', anonymous, {
      email,
      password: secret,
      client: firefox,
      ...(trustedDeviceToken === undefined ? {} : { trustedDeviceToken }),
    });
    const token = (response.body as { token?: unknown }).token;
    if (typeof token === 'string') {
      secrets.push(token);
    }
    return response;
  }

  /**
   * Signs a stored account without two-step verification in.
   *
   * @param account - The account.
   * @returns The signed-in person.
   */
  async function signIn(account: {
    readonly userId: string;
    readonly email: string;
  }): Promise<SignedIn> {
    const response = await passwordSignIn(account.email);
    expect(response.status).toBe(200);
    const body = response.body as { token: string; session: { id: string } };
    return { ...account, sessionId: body.session.id, token: body.token };
  }

  /**
   * The code the authenticator app of an account shows now, its last accepted step cleared first
   * so that a scenario can use a second code within the same 30 seconds.
   *
   * @param userId - The account.
   * @param secret - The secret of its app.
   * @returns The 6 digits.
   */
  async function appCode(userId: string, secret: string): Promise<string> {
    await systemQuery(
      'update two_step_verifications set last_accepted_time_step = null where user_id = $1',
      [userId],
    );
    const code = await generate({ secret, epoch: Math.floor(Date.now() / 1000) });
    secrets.push(code);
    return code;
  }

  /**
   * Turns two-step verification on for a signed-in person, from the session of the sign-in.
   *
   * @param person - The person.
   * @returns The person, the secret of the app and the backup codes.
   */
  async function enroll(person: SignedIn): Promise<Enrolled> {
    const setup = await call(
      'post',
      `/internal/v1/users/${person.userId}/two-step-verification/authenticator-app/setup`,
      user(person.userId),
      { sessionId: person.sessionId },
    );
    expect(setup.status).toBe(200);
    const { secret, otpauthUri } = StartAuthenticatorAppSetupInternalResponse.parse(setup.body);
    secrets.push(secret, otpauthUri);
    const confirmed = await call(
      'post',
      `/internal/v1/users/${person.userId}/two-step-verification/authenticator-app/setup/confirmation`,
      user(person.userId),
      { sessionId: person.sessionId, code: await appCode(person.userId, secret), client: firefox },
    );
    expect(confirmed.status).toBe(200);
    const body = ConfirmAuthenticatorAppSetupInternalResponse.parse(confirmed.body);
    const backupCodes = body.backupCodes?.codes ?? [];
    secrets.push(...backupCodes);
    return { ...person, secret, backupCodes };
  }

  /**
   * Signs a person with two-step verification in with the password, which answers a challenge.
   *
   * @param email - The address.
   * @returns The token of the challenge and its body.
   */
  async function challenge(
    email: string,
  ): Promise<{ token: string; body: Record<string, unknown> }> {
    const response = await passwordSignIn(email);
    expect(response.status).toBe(202);
    const body = response.body as Record<string, unknown>;
    const token = body.token as string;
    secrets.push(token);
    return { token, body };
  }

  /**
   * Reads the payloads of the outbox rows of an event of an account, oldest first.
   *
   * @param name - The event.
   * @param userId - The account.
   * @returns The payloads.
   */
  async function events(name: string, userId: string): Promise<Record<string, unknown>[]> {
    const rows = await systemQuery<{ payload: Record<string, unknown> }>(
      `select payload from outbox_events where event_name = $1 and payload->>'userId' = $2
        order by created_at, id`,
      [name, userId],
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
    vi.stubEnv('WEBAUTHN_RP_ID', rpId);
    vi.stubEnv('WEBAUTHN_ORIGINS', origin);

    membershipAuthority = await startOrganizationMembershipAuthority(
      async (organizationId, userId) => {
        const [membership] = await systemQuery<SearchMembership>(
          `select id as "memberId", role, version from memberships
          where organization_id = $1 and user_id = $2 and removed_at is null`,
          [organizationId, userId],
        );
        if (membership === undefined) return null;
        const role = liveRoles.get(`${organizationId}/${userId}`) ?? membership.role;
        return { ...membership, role };
      },
    );
    vi.stubEnv('ORGANIZATION_SERVICE_URL', membershipAuthority.origin);
    vi.stubEnv('IDENTITY_SERVICE_INTERNAL_TOKEN_PRIVATE_JWK', membershipAuthority.privateJwk);
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
      await membershipAuthority?.close();
      vi.unstubAllEnvs();
      compose('down', '--volumes', '--remove-orphans');
    }
  });

  describe('the setup of an authenticator app', () => {
    it('turns two-step verification on with a code of the app, its secret sealed, and emits it', async () => {
      const camille = await enroll(await signIn(await seedAccount('Camille')));

      expect(camille.backupCodes).toHaveLength(10);
      expect(camille.backupCodes.every((code) => /^[0-9A-Z]{4}-[0-9A-Z]{4}$/u.test(code))).toBe(
        true,
      );
      const card = await call(
        'get',
        `/internal/v1/users/${camille.userId}/two-step-verification`,
        user(camille.userId),
      );
      expect(card.status).toBe(200);
      expect(GetTwoStepVerificationInternalResponse.parse(card.body)).toMatchObject({
        enabled: true,
        primaryMethod: 'authenticator-app',
        methods: ['authenticator-app'],
        securityKeys: [],
        backupCodes: { remaining: 10, total: 10 },
        requiredBy: [],
      });
      const [stored] = await systemQuery<{ authenticator_secret: string }>(
        'select authenticator_secret from two_step_verifications where user_id = $1',
        [camille.userId],
      );
      expect(stored?.authenticator_secret.startsWith('k1.')).toBe(true);
      expect(stored?.authenticator_secret).not.toContain(camille.secret);
      const codes = await systemQuery<{ code_hash: string }>(
        'select code_hash from backup_codes where user_id = $1',
        [camille.userId],
      );
      expect(codes).toHaveLength(10);
      expect(codes.some(({ code_hash }) => camille.backupCodes.includes(code_hash))).toBe(false);
      const [changed] = await events('user.two-step-verification-changed.v1', camille.userId);
      expect(userTwoStepVerificationChangedV1Schema.parse(changed)).toMatchObject({
        change: 'enabled',
        enabled: true,
        methods: ['authenticator-app'],
        backupCodesRemaining: 10,
        securityKey: null,
      });
    });

    it('refuses a wrong code without counting it, and the setup of another session', async () => {
      const account = await seedAccount('Lea');
      const lea = await signIn(account);
      const other = await signIn(account);
      const setup = await call(
        'post',
        `/internal/v1/users/${lea.userId}/two-step-verification/authenticator-app/setup`,
        user(lea.userId),
        { sessionId: lea.sessionId },
      );
      const { secret } = StartAuthenticatorAppSetupInternalResponse.parse(setup.body);
      secrets.push(secret);
      const confirmation = `/internal/v1/users/${lea.userId}/two-step-verification/authenticator-app/setup/confirmation`;

      const wrong = await call('post', confirmation, user(lea.userId), {
        sessionId: lea.sessionId,
        code: '000000',
        client: firefox,
      });
      const elsewhere = await call('post', confirmation, user(lea.userId), {
        sessionId: other.sessionId,
        code: await generate({ secret, epoch: Math.floor(Date.now() / 1000) }),
        client: firefox,
      });

      expect(wrong.status).toBe(422);
      expect(wrong.body).toMatchObject({ code: 'auth.two-step-code-invalid' });
      expect(wrong.body).not.toHaveProperty('details');
      expect(elsewhere.status).toBe(422);
      expect(elsewhere.body).toMatchObject({ code: 'auth.two-step-setup-expired' });
    });

    it('rolls the enabling back, the setup kept, when its event cannot be written', async () => {
      const ines = await signIn(await seedAccount('Ines'));
      const setup = await call(
        'post',
        `/internal/v1/users/${ines.userId}/two-step-verification/authenticator-app/setup`,
        user(ines.userId),
        { sessionId: ines.sessionId },
      );
      const { secret } = StartAuthenticatorAppSetupInternalResponse.parse(setup.body);
      secrets.push(secret);
      const outbox = app.get(OutboxWriter);
      const append = outbox.append.bind(outbox);
      const failing = vi
        .spyOn(outbox, 'append')
        .mockImplementation((...args: Parameters<OutboxWriter['append']>) =>
          args[2] === 'user.two-step-verification-changed.v1'
            ? Promise.reject(new Error('the outbox refuses the row'))
            : append(...args),
        );
      const confirmation = `/internal/v1/users/${ines.userId}/two-step-verification/authenticator-app/setup/confirmation`;

      let response: Response;
      try {
        response = await call('post', confirmation, user(ines.userId), {
          sessionId: ines.sessionId,
          code: await generate({ secret, epoch: Math.floor(Date.now() / 1000) }),
          client: firefox,
        });
      } finally {
        failing.mockRestore();
      }

      expect(response.status).toBe(500);
      expect(
        await systemQuery('select 1 from two_step_verifications where user_id = $1', [ines.userId]),
      ).toEqual([]);
      expect(
        await systemQuery('select 1 from backup_codes where user_id = $1', [ines.userId]),
      ).toEqual([]);
      expect(
        await systemQuery('select 1 from two_step_enrollments where user_id = $1', [ines.userId]),
      ).toEqual([]);
      expect(await events('user.two-step-verification-changed.v1', ines.userId)).toEqual([]);
      expect((await passwordSignIn(ines.email)).status).toBe(200);

      const retried = await call('post', confirmation, user(ines.userId), {
        sessionId: ines.sessionId,
        code: await generate({ secret, epoch: Math.floor(Date.now() / 1000) }),
        client: firefox,
      });
      expect(retried.status).toBe(200);
      secrets.push(...(retried.body as { backupCodes: { codes: string[] } }).backupCodes.codes);
    });
  });

  describe('the two-step challenge', () => {
    it('answers 202 to the right password, then opens the session for a code of the app', async () => {
      const camille = await enroll(await signIn(await seedAccount('Camille')));
      const { token, body } = await challenge(camille.email);

      expect(body).toMatchObject({
        email: camille.email,
        primaryMethod: 'authenticator-app',
        methods: ['authenticator-app', 'backup-code'],
        securityKeys: [],
        backupCodesRemaining: 10,
        lockedUntil: null,
      });
      expect(body).not.toHaveProperty('session');
      const inspected = await call(
        'post',
        '/internal/v1/auth/sign-in/challenge/inspection',
        anonymous,
        { token },
      );
      expect(inspected.status).toBe(200);
      expect(InspectSignInChallengeInternalResponse.parse(inspected.body).token).toBe(token);

      const answered = await call(
        'post',
        '/internal/v1/auth/sign-in/challenge/authenticator-app',
        anonymous,
        { token, code: await appCode(camille.userId, camille.secret), client: firefox },
      );

      expect(answered.status).toBe(200);
      const issued = AnswerSignInChallengeWithAuthenticatorAppInternalResponse.parse(answered.body);
      secrets.push(issued.token);
      expect(issued.trustedDevice).toBeUndefined();
      const [session] = await systemQuery<{ by_two_step: boolean }>(
        'select two_step_authenticated_at = authenticated_at as by_two_step from sessions where id = $1',
        [issued.session.id],
      );
      expect(session?.by_two_step).toBe(true);
      const again = await call(
        'post',
        '/internal/v1/auth/sign-in/challenge/authenticator-app',
        anonymous,
        { token, code: await appCode(camille.userId, camille.secret), client: firefox },
      );
      expect(again.status).toBe(422);
      expect(again.body).toMatchObject({ code: 'auth.challenge-expired' });
    });

    it('accepts a backup code once', async () => {
      const lea = await enroll(await signIn(await seedAccount('Lea')));
      const code = lea.backupCodes[3] ?? '';

      const first = await call(
        'post',
        '/internal/v1/auth/sign-in/challenge/backup-code',
        anonymous,
        {
          token: (await challenge(lea.email)).token,
          code: code.toLowerCase().replace('-', ''),
          client: firefox,
        },
      );
      const second = await call(
        'post',
        '/internal/v1/auth/sign-in/challenge/backup-code',
        anonymous,
        { token: (await challenge(lea.email)).token, code, client: firefox },
      );

      expect(first.status).toBe(200);
      secrets.push((first.body as { token: string }).token);
      expect(second.status).toBe(422);
      expect(second.body).toMatchObject({
        code: 'auth.two-step-code-invalid',
        details: { remainingAttempts: 4 },
      });
      expect((await challenge(lea.email)).body).toMatchObject({ backupCodesRemaining: 9 });
    });

    it('locks the answers for 15 minutes after the fifth wrong one, the right one included', async () => {
      const lucas = await enroll(await signIn(await seedAccount('Lucas')));
      const { token } = await challenge(lucas.email);
      const path = '/internal/v1/auth/sign-in/challenge/authenticator-app';
      for (let attempt = 1; attempt < 5; attempt += 1) {
        const wrong = await call('post', path, anonymous, {
          token,
          code: '000000',
          client: firefox,
        });
        expect(wrong.status).toBe(422);
        expect(wrong.body).toMatchObject({ details: { remainingAttempts: 5 - attempt } });
      }

      const fifth = await call('post', path, anonymous, { token, code: '000000', client: firefox });
      const right = await call('post', path, anonymous, {
        token,
        code: await appCode(lucas.userId, lucas.secret),
        client: firefox,
      });

      expect(fifth.status).toBe(429);
      expect(fifth.body).toMatchObject({ code: 'auth.two-step-locked' });
      expect(Number(fifth.headers['retry-after'])).toBeGreaterThan(14 * 60);
      expect(right.status).toBe(429);
      expect(right.body).toMatchObject({ code: 'auth.two-step-locked' });
    });

    it('skips the challenge on a trusted device, until a change of the password forgets it', async () => {
      const hugo = await enroll(await signIn(await seedAccount('Hugo')));
      const answered = await call(
        'post',
        '/internal/v1/auth/sign-in/challenge/authenticator-app',
        anonymous,
        {
          token: (await challenge(hugo.email)).token,
          code: await appCode(hugo.userId, hugo.secret),
          trustDevice: true,
          client: firefox,
        },
      );
      const issued = AnswerSignInChallengeWithAuthenticatorAppInternalResponse.parse(answered.body);
      const device = issued.trustedDevice?.token ?? '';
      secrets.push(issued.token, device);
      expect(device).not.toBe('');

      const trusted = await passwordSignIn(hugo.email, device);
      expect(trusted.status).toBe(200);
      expect(await passwordSignIn(hugo.email, 'not-a-trusted-device-token')).toMatchObject({
        status: 202,
      });

      const reauthenticated = await call(
        'post',
        `/internal/v1/sessions/${issued.session.id}/reauthentication`,
        user(hugo.userId),
        { code: await appCode(hugo.userId, hugo.secret) },
      );
      expect(reauthenticated.status).toBe(200);
      const changed = await call(
        'put',
        `/internal/v1/users/${hugo.userId}/password`,
        user(hugo.userId),
        {
          sessionId: issued.session.id,
          currentPassword: password,
          newPassword,
          client: firefox,
        },
      );
      expect(changed.status).toBe(200);

      const forgotten = await passwordSignIn(hugo.email, device, newPassword);
      expect(forgotten.status).toBe(202);
      secrets.push((forgotten.body as { token: string }).token);
    });
  });

  describe('the security keys', () => {
    it('registers a key from http://app.cadenway.localhost and signs in with it', async () => {
      const camille = await enroll(await signIn(await seedAccount('Camille')));
      const authenticator = new SoftwareAuthenticator(rpId, origin);
      const registration = await call(
        'post',
        `/internal/v1/users/${camille.userId}/two-step-verification/security-keys/registration`,
        user(camille.userId),
        { sessionId: camille.sessionId },
      );
      expect(registration.status).toBe(200);
      const creation = StartSecurityKeyRegistrationInternalResponse.parse(registration.body);
      expect(creation.options.rp).toMatchObject({ id: rpId });
      const credential = authenticator.register(creation.options);
      secrets.push(JSON.stringify(credential));

      const added = await call(
        'post',
        `/internal/v1/users/${camille.userId}/two-step-verification/security-keys`,
        user(camille.userId),
        { sessionId: camille.sessionId, name: '  YubiKey 5C NFC ', credential, client: firefox },
      );

      expect(added.status).toBe(201);
      const key = AddSecurityKeyInternalResponse.parse(added.body);
      expect(key.name).toBe('YubiKey 5C NFC');
      expect(added.headers.location).toBe(
        `/internal/v1/users/${camille.userId}/two-step-verification/security-keys/${key.id}`,
      );
      const { token, body } = await challenge(camille.email);
      expect(body).toMatchObject({
        methods: ['authenticator-app', 'security-key', 'backup-code'],
        securityKeys: [{ name: 'YubiKey 5C NFC' }],
      });
      const options = await call(
        'post',
        '/internal/v1/auth/sign-in/challenge/security-key/options',
        anonymous,
        { token },
      );
      expect(options.status).toBe(200);
      const assertionOptions = GetSignInChallengeSecurityKeyOptionsInternalResponse.parse(
        options.body,
      );
      expect(assertionOptions.options.rpId).toBe(rpId);
      const [handle] = await systemQuery<{ webauthn_user_handle: string }>(
        'select webauthn_user_handle from two_step_verifications where user_id = $1',
        [camille.userId],
      );
      const assertion = authenticator.assert(
        assertionOptions.options,
        handle?.webauthn_user_handle ?? null,
      );
      secrets.push(JSON.stringify(assertion));

      const answered = await call(
        'post',
        '/internal/v1/auth/sign-in/challenge/security-key',
        anonymous,
        { token, credential: assertion, client: firefox },
      );

      expect(answered.status).toBe(200);
      secrets.push((answered.body as { token: string }).token);
      const [used] = await systemQuery<{ counter: string; last_used_at: Date | null }>(
        'select counter, last_used_at from security_keys where id = $1',
        [key.id],
      );
      expect(used?.counter).toBe('1');
      expect(used?.last_used_at).not.toBeNull();
      expect(
        (await events('user.two-step-verification-changed.v1', camille.userId)).map(
          (payload) => payload.change,
        ),
      ).toEqual(['enabled', 'security-key-added']);
    });

    it('refuses an assertion from another origin, counted as a wrong answer', async () => {
      const lea = await enroll(await signIn(await seedAccount('Lea')));
      const authenticator = new SoftwareAuthenticator(rpId, origin);
      const registration = await call(
        'post',
        `/internal/v1/users/${lea.userId}/two-step-verification/security-keys/registration`,
        user(lea.userId),
        { sessionId: lea.sessionId },
      );
      const creation = StartSecurityKeyRegistrationInternalResponse.parse(registration.body);
      await call(
        'post',
        `/internal/v1/users/${lea.userId}/two-step-verification/security-keys`,
        user(lea.userId),
        {
          sessionId: lea.sessionId,
          name: 'Touch ID',
          credential: authenticator.register(creation.options),
          client: firefox,
        },
      );
      const { token } = await challenge(lea.email);
      const options = GetSignInChallengeSecurityKeyOptionsInternalResponse.parse(
        (
          await call(
            'post',
            '/internal/v1/auth/sign-in/challenge/security-key/options',
            anonymous,
            {
              token,
            },
          )
        ).body,
      );

      const phished = await call(
        'post',
        '/internal/v1/auth/sign-in/challenge/security-key',
        anonymous,
        {
          token,
          credential: authenticator.assert(options.options, null, {
            origin: 'http://evil.cadenway.localhost',
          }),
          client: firefox,
        },
      );

      expect(phished.status).toBe(422);
      expect(phished.body).toMatchObject({
        code: 'auth.security-key-refused',
        details: { remainingAttempts: 4 },
      });
    });
  });

  describe('the re-authentication by code', () => {
    it('refuses the password of an account with two-step verification, uncounted, and takes a code once', async () => {
      const theo = await enroll(await signIn(await seedAccount('Theo')));
      const path = `/internal/v1/sessions/${theo.sessionId}/reauthentication`;

      const withPassword = await call('post', path, user(theo.userId), { password });
      const both = await call('post', path, user(theo.userId), { password, code: '123456' });
      const code = await appCode(theo.userId, theo.secret);
      const withCode = await call('post', path, user(theo.userId), { code });
      const replayed = await call('post', path, user(theo.userId), { code });

      expect(withPassword.status).toBe(403);
      expect(withPassword.body).toMatchObject({
        code: 'auth.reauthentication-required',
        details: { methods: ['authenticator-app'] },
      });
      expect(both.status).toBe(400);
      expect(withCode.status).toBe(200);
      expect(replayed.status).toBe(422);
      expect(replayed.body).toMatchObject({ code: 'auth.two-step-code-invalid' });
      expect(
        await systemQuery(
          'select 1 from sign_in_attempts where email = $1 and failed_attempts > 0',
          [theo.email],
        ),
      ).toEqual([]);
    });
  });

  describe('the authentication policy of an organization', () => {
    it('withholds the organization from a member without two-step verification, and keeps it on', async () => {
      const organization = randomUUID();
      const camille = await enroll(await signIn(await seedAccount('Camille')));
      const ines = await signIn(await seedAccount('Ines'));
      await seedMembership(camille.userId, 'owner', organization);
      await seedMembership(ines.userId, 'admin', organization);
      for (const person of [camille, ines]) {
        const chosen = await call(
          'put',
          `/internal/v1/sessions/${person.sessionId}/organization`,
          user(person.userId),
          { organizationId: organization },
        );
        expect(chosen.status).toBe(200);
      }
      const created = await call(
        'post',
        '/internal/v1/api-tokens',
        user(ines.userId, organization),
        {
          name: 'Synchronisation GitLab',
          scopes: ['tasks:read'],
          sessionId: ines.sessionId,
        },
      );
      expect(created.status).toBe(201);
      const apiToken = (created.body as { secret: string }).secret;
      secrets.push(apiToken);
      const current = await call(
        'get',
        '/internal/v1/organization/authentication-policy',
        user(camille.userId, organization),
      );
      expect(current.status).toBe(200);

      const updated = await call(
        'patch',
        `/internal/v1/organization/authentication-policy?sessionId=${camille.sessionId}`,
        user(camille.userId, organization),
        { twoStepVerificationRequiredFor: 'admins' },
        String(current.headers.etag),
      );

      expect(updated.status).toBe(200);
      expect(updated.body).toMatchObject({
        twoStepVerificationRequiredFor: 'admins',
        membersWithoutTwoStepVerification: { admins: 1 },
      });
      liveRoles.set(`${organization}/${ines.userId}`, 'member');
      const denied = await call(
        'patch',
        `/internal/v1/organization/authentication-policy?sessionId=${ines.sessionId}`,
        user(ines.userId, organization),
        { twoStepVerificationRequiredFor: 'nobody' },
        String(updated.headers.etag),
      );
      liveRoles.delete(`${organization}/${ines.userId}`);
      expect(denied.status).toBe(403);
      expect(denied.body).toMatchObject({ code: 'organization.role-forbidden' });
      const session = await call('post', '/internal/v1/tokens/introspect', system, {
        token: ines.token,
      });
      expect(session.body).toMatchObject({
        active: true,
        organizationId: null,
        role: null,
        withheldOrganization: { organizationId: organization, code: 'organization.mfa-required' },
      });
      const token = await call('post', '/internal/v1/api-tokens/introspect', system, {
        token: apiToken,
      });
      expect(token.body).toMatchObject({
        active: true,
        scopes: [],
        withheldOrganization: { organizationId: organization },
      });
      const chosenAgain = await call(
        'put',
        `/internal/v1/sessions/${ines.sessionId}/organization`,
        user(ines.userId),
        { organizationId: organization },
      );
      expect(chosenAgain.status).toBe(403);
      expect(chosenAgain.body).toMatchObject({
        code: 'organization.mfa-required',
        details: { organizationId: organization },
      });
      const owner = await call('post', '/internal/v1/tokens/introspect', system, {
        token: camille.token,
      });
      expect(owner.body).toMatchObject({ organizationId: organization, role: 'owner' });
      expect(owner.body).not.toHaveProperty('withheldOrganization');

      const disabled = await call(
        'post',
        `/internal/v1/users/${camille.userId}/two-step-verification/disable`,
        user(camille.userId),
        { sessionId: camille.sessionId, client: firefox },
      );
      expect(disabled.status).toBe(409);
      expect(disabled.body).toMatchObject({
        code: 'auth.mfa-required-by-organization',
        details: { organizationIds: [organization] },
      });

      await enroll(ines);
      const restored = await call('post', '/internal/v1/tokens/introspect', system, {
        token: ines.token,
      });
      expect(restored.body).toMatchObject({ organizationId: organization, role: 'admin' });
      expect(restored.body).not.toHaveProperty('withheldOrganization');
    });
  });

  describe('the disabling', () => {
    it('deletes the factors, forgets the trusted devices and signs in with the password again', async () => {
      const nora = await enroll(await signIn(await seedAccount('Nora')));

      const disabled = await call(
        'post',
        `/internal/v1/users/${nora.userId}/two-step-verification/disable`,
        user(nora.userId),
        { sessionId: nora.sessionId, client: firefox },
      );
      const again = await call(
        'post',
        `/internal/v1/users/${nora.userId}/two-step-verification/disable`,
        user(nora.userId),
        { sessionId: nora.sessionId, client: firefox },
      );

      expect(disabled.status).toBe(204);
      expect(again.status).toBe(204);
      expect(
        await systemQuery('select 1 from backup_codes where user_id = $1', [nora.userId]),
      ).toEqual([]);
      expect((await passwordSignIn(nora.email)).status).toBe(200);
      expect(
        (await events('user.two-step-verification-changed.v1', nora.userId)).map(
          (payload) => payload.change,
        ),
      ).toEqual(['enabled', 'disabled']);
    });
  });

  describe('the events', () => {
    it('publishes one message per change on EVENTS, even when the relay sends a row again', async () => {
      const mila = await enroll(await signIn(await seedAccount('Mila')));
      const regenerated = await call(
        'post',
        `/internal/v1/users/${mila.userId}/two-step-verification/backup-codes/regenerate`,
        user(mila.userId),
        { sessionId: mila.sessionId, client: firefox },
      );
      expect(regenerated.status).toBe(200);
      secrets.push(...(regenerated.body as { codes: string[] }).codes);
      await published('user.two-step-verification-changed.v1');
      const subject = 'evt.user.two-step-verification-changed.v1';
      const before = streamSubjects('EVENTS')[subject] ?? 0;

      await systemQuery(
        `update outbox_events
            set status = 'pending', sent_at = null, attempts = 0, next_attempt_at = now()
          where event_name = 'user.two-step-verification-changed.v1' and payload->>'userId' = $1`,
        [mila.userId],
      );
      await published('user.two-step-verification-changed.v1');

      expect(before).toBeGreaterThan(0);
      expect(streamSubjects('EVENTS')[subject]).toBe(before);
      expect(
        (await events('user.two-step-verification-changed.v1', mila.userId)).map(
          (payload) => payload.change,
        ),
      ).toEqual(['enabled', 'backup-codes-regenerated']);
    });
  });

  describe('the logs', () => {
    it('never hold a password, a secret of an app, a code, a backup code or a token', () => {
      expect(logLines.length).toBeGreaterThan(50);
      expect(secrets.length).toBeGreaterThan(40);
      // A 6-digit code is looked for as a whole number, so that the digits of a timestamp or an
      // id do not pass for it.
      const leaks = logLines.filter((line) =>
        secrets.some((secret) =>
          /^[0-9]{6}$/u.test(secret)
            ? new RegExp(`(?<![0-9])${secret}(?![0-9])`, 'u').test(line)
            : line.includes(secret),
        ),
      );

      expect(leaks).toEqual([]);
    });
  });
});
