import { execFileSync } from 'node:child_process';
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  GetNotificationRecipientInternalResponse,
  ReserveAvatarUploadInternalResponse,
} from '@cadenway/contracts/validators/internal/identity-service';
import {
  createApplication,
  InternalTokenSigner,
  JSON_BODY_LIMIT_BYTES,
  loadConfig,
  runWithOrganizationContext,
} from '@cadenway/nest-common';
import type {
  Ed25519PrivateJwk,
  Ed25519PublicJwk,
  OrganizationContext,
} from '@cadenway/nest-common';
import { SystemTransactionRunner, TenantTransactionRunner } from '@cadenway/nest-common/database';
import { Controller, Get, Injectable, Module } from '@nestjs/common';
import type { BeforeApplicationShutdown } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { appConfigSchema } from '../src/config/app-config.js';
import { configurePrivateHttpPolicies } from '../src/infrastructure/private-http-policies.js';
import { RealtimeTicketNotFound } from '../src/modules/sessions/application/models/realtime-ticket/realtime-ticket-not-found.model.js';
import { RealtimeOrganizationNotSelected } from '../src/modules/sessions/application/models/realtime-ticket/realtime-organization-not-selected.model.js';
import { SessionNotFound } from '../src/modules/sessions/application/models/session/session-not-found.model.js';
import { IssueRealtimeTicket } from '../src/modules/sessions/application/use-cases/commands/realtime-ticket/issue-realtime-ticket/issue-realtime-ticket.use-case.js';
import { RedeemRealtimeTicket } from '../src/modules/sessions/application/use-cases/commands/realtime-ticket/redeem-realtime-ticket/redeem-realtime-ticket.use-case.js';
import { SystemExpiredRealtimeTicketsUnitOfWork } from '../src/modules/sessions/infrastructure/persistence/drizzle/transactions/session/system-expired-realtime-tickets.unit-of-work.js';
import { freePort } from './support/loopback-port.fixture.js';

// The service as main.ts assembles it, on a disposable PostgreSQL and NATS. `@cadenway/nest-testing`
// does not export its container fixtures yet and a service never depends on `testcontainers` itself,
// so the dependencies are those of compose.dev.yaml, started as a throwaway Compose project on free
// ports: PostgreSQL with the two roles of cadenway-ops, NATS with its authorization (the `identity`
// user, its subjects, the inbox prefix `_INBOX.identity`) and its three streams.

/** Compose file of the development dependencies. */
const composeFile: string = fileURLToPath(new URL('../compose.dev.yaml', import.meta.url));

/** Throwaway project name: it never touches the data of the developer's own dev stack. */
const project = `cadenway-identity-service-test-${String(process.pid)}`;

/**
 * Host port of NATS. Fixed for the run, unlike the ephemeral port of PostgreSQL: the service must
 * find NATS at the same address after the test restarts it, and Docker gives an ephemeral mapping a
 * new port at each start.
 */
let natsHostPort = '0';

/** Atelier Nord, the organization of the mockup. */
const atelierNordId = '01938f6e-6d1a-7c3e-9a51-2f0c4b8d7e10';

/** Another organization, which must never see a row of Atelier Nord. */
const otherOrganizationId = '01938f6e-0000-7000-8000-000000000002';

/** Camille Martin (CM), the member of Atelier Nord the mockup signs in as. */
const camilleMartinId = '01938f6e-8a42-7d5b-b2c9-5e1f3a6d9c24';

/** The tables of the platform module, as the kit names them. */
const platformTables = [
  'event_versions',
  'idempotency_keys',
  'outbox_events',
  'processed_events',
] as const;

/**
 * The tables of the business modules: accounts (users, credentials, codes, throttles, lockout,
 * reset links, pending changes of address, two-step verification), sessions (sessions, realtime
 * tickets, the last organization each account chose, trusted devices, two-step enrollments and the
 * authentication policies), memberships (the copy of the memberships) and api-tokens. Those with an
 * `organization_id` carry the forced policy of the kit.
 */
const businessTables = [
  'api_tokens',
  'authentication_policies',
  'authenticator_app_setups',
  'avatar_uploads',
  'backup_codes',
  'code_requests',
  'email_changes',
  'federated_account_links',
  'federated_sign_in_flows',
  'memberships',
  'one_time_codes',
  'organization_choices',
  'password_credentials',
  'password_reset_links',
  'password_reset_requests',
  'realtime_tickets',
  'saml_account_links',
  'saml_assertion_replays',
  'security_key_registrations',
  'security_keys',
  'sessions',
  'sign_in_attempts',
  'sign_in_challenges',
  'trusted_devices',
  'two_step_enrollments',
  'two_step_verifications',
  'users',
] as const;

/** Every table of `public`, in name order, as the migrations create them. */
const allTables = [...platformTables, ...businessTables].sort();

/** Migrations of `migrations/meta/_journal.json`. */
const migrationCount = 12;

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
      env: { ...process.env, DEV_POSTGRES_PORT: '0', DEV_NATS_PORT: natsHostPort },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
}

/**
 * Runs the NATS command line of the `nats-streams` container against the broker of the project.
 *
 * @param env - Variables that replace the `admin` credentials of the container for this call.
 * @param args - Arguments of the `nats` command.
 * @returns Whether the broker accepted the command.
 */
function brokerAccepts(env: Readonly<Record<string, string>>, ...args: readonly string[]): boolean {
  const variables = Object.entries(env).flatMap(([name, value]) => ['--env', `${name}=${value}`]);
  try {
    compose('exec', '-T', ...variables, 'nats-streams', 'nats', '--timeout', '2s', ...args);
    return true;
  } catch {
    return false;
  }
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
 * Creates an Ed25519 key pair in the JWK forms the internal token uses.
 *
 * @param kid - Key id of the test issuer.
 * @returns The public key for the verifier and the private key for a signer.
 */
function keyPair(kid = 'test-api-gateway'): {
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
 * The organization context of a member of an organization, as the internal token gives it.
 *
 * @param organizationId - Organization of the context.
 * @returns The context the tenant runner reads.
 */
function memberOf(organizationId: string): OrganizationContext {
  return {
    organizationId,
    actor: { type: 'user', id: camilleMartinId },
    role: null,
    scopes: [],
  };
}

/**
 * Applies the migrations with `src/migrate.ts`, the entry point of the migration container, as
 * the migrator role. Each call imports the module afresh, as each container start runs it once.
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

/** Releases the shutdown held by `ShutdownGate`. */
let releaseShutdown: () => void = () => undefined;

/** Settles once `releaseShutdown` is called. */
const shutdownReleased = new Promise<void>((resolve) => {
  releaseShutdown = resolve;
});

/**
 * Holds the shutdown after readiness turned down and before the listener closes, the way a slow
 * handler or relay pass would, so the probes can be read during the stop.
 */
@Injectable()
class ShutdownGate implements BeforeApplicationShutdown {
  public async beforeApplicationShutdown(): Promise<void> {
    await shutdownReleased;
  }
}

/** A route of the application that declares no exemption, like every business route will. */
@Controller('internal/v1/wiring-probe')
class WiringProbeController {
  @Get()
  public probe(): { readonly reached: true } {
    return { reached: true };
  }
}

describe('identity-service wiring', () => {
  const gateway = keyPair();
  const notification = keyPair('test-notification-service');
  let app: NestExpressApplication | undefined;
  let signer: InternalTokenSigner;
  let notificationSigner: InternalTokenSigner;
  let migrator: pg.Pool;

  /**
   * The running application.
   *
   * @returns The application created in `beforeAll`.
   */
  function service(): NestExpressApplication {
    if (app === undefined) {
      throw new Error('The application did not start.');
    }
    return app;
  }

  beforeAll(async () => {
    natsHostPort = await freePort();
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

    vi.stubEnv(
      'MIGRATION_DATABASE_URL',
      `postgres://identity_migrator:identity_migrator@127.0.0.1:${postgresPort}/identity`,
    );
    await runMigrator();
    migrator = new pg.Pool({
      connectionString: `postgres://identity_migrator:identity_migrator@127.0.0.1:${postgresPort}/identity`,
      max: 1,
      // Kept open for the whole run, so the stop of PostgreSQL below always reaches it.
      idleTimeoutMillis: 0,
    });
    // The client is terminated (57P01) when a test stops PostgreSQL; the pool reports it as an
    // `error` event, which would otherwise be an uncaught exception.
    migrator.on('error', () => undefined);

    vi.stubEnv('PORT', '3010');
    vi.stubEnv('LOG_PRETTY', 'false');
    vi.stubEnv(
      'DATABASE_URL',
      `postgres://identity_app:identity_app@127.0.0.1:${postgresPort}/identity`,
    );
    vi.stubEnv('NATS_URL', `nats://127.0.0.1:${natsHostPort}`);
    vi.stubEnv('NATS_USER', 'identity');
    vi.stubEnv('NATS_PASSWORD', 'identity');
    vi.stubEnv('INTERNAL_TOKEN_AUDIENCE', 'identity-service');
    vi.stubEnv(
      'INTERNAL_TOKEN_TRUSTED_ISSUERS',
      JSON.stringify({ 'api-gateway': [gateway.publicJwk] }),
    );
    vi.stubEnv(
      'NOTIFICATION_SERVICE_INTERNAL_TOKEN_PUBLIC_JWKS',
      JSON.stringify(notification.publicJwk),
    );
    vi.stubEnv('PASSWORD_PEPPER', 'integration-test-password-pepper-000000000000');
    vi.stubEnv('WEBAUTHN_RP_ID', 'app.cadenway.localhost');
    vi.stubEnv('WEBAUTHN_ORIGINS', 'http://app.cadenway.localhost');

    @Module({
      imports: [AppModule],
      controllers: [WiringProbeController],
      providers: [ShutdownGate],
    })
    class ProbedApplicationModule {}

    // As main.ts: the configuration is read inside the start-up, never when a module is imported.
    const config = loadConfig(appConfigSchema);
    app = await createApplication(ProbedApplicationModule, {
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
    configurePrivateHttpPolicies(app);
    await app.init();
    signer = await InternalTokenSigner.create({
      issuer: 'api-gateway',
      privateJwk: gateway.privateJwk,
    });
    notificationSigner = await InternalTokenSigner.create({
      issuer: 'notification-service',
      privateJwk: notification.privateJwk,
    });
  });

  afterAll(async () => {
    try {
      releaseShutdown();
      await app?.close();
      await migrator.end();
    } finally {
      vi.unstubAllEnvs();
      compose('down', '--volumes', '--remove-orphans');
    }
  });

  it('applies its migrations as the migrator role, which owns every table', async () => {
    const tables = await migrator.query<{ tablename: string; tableowner: string }>(
      `select tablename, tableowner from pg_tables where schemaname = 'public' order by tablename`,
    );
    const journal = await migrator.query<{ applied: number }>(
      'select count(*)::int as applied from drizzle.__drizzle_migrations',
    );

    expect(tables.rows).toEqual(
      allTables.map((tablename) => ({ tablename, tableowner: 'identity_migrator' })),
    );
    expect(journal.rows).toEqual([{ applied: migrationCount }]);
  });

  it('applies nothing when the migrator runs again', async () => {
    await runMigrator();

    const journal = await migrator.query<{ applied: number }>(
      'select count(*)::int as applied from drizzle.__drizzle_migrations',
    );
    expect(journal.rows).toEqual([{ applied: migrationCount }]);
  });

  it('forces row-level security on the tables that carry an organization, and only on them', async () => {
    const tables = await migrator.query<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `select relname, relrowsecurity, relforcerowsecurity
         from pg_class
        where relnamespace = 'public'::regnamespace and relkind = 'r'
        order by relname`,
    );
    const policies = await migrator.query<{ tablename: string; policyname: string }>(
      `select tablename, policyname from pg_policies where schemaname = 'public' order by tablename`,
    );
    // Read from the catalog, not from a list kept by hand: a new table with an organization and
    // no forced policy fails here, whoever adds it.
    const withOrganization = await migrator.query<{ table_name: string }>(
      `select table_name from information_schema.columns
        where table_schema = 'public' and column_name = 'organization_id'
        order by table_name`,
    );

    const withPolicy: readonly string[] = withOrganization.rows.map(({ table_name }) => table_name);
    expect(withPolicy).toEqual([
      'api_tokens',
      'authentication_policies',
      'event_versions',
      'idempotency_keys',
      'memberships',
      'organization_choices',
      'outbox_events',
      'realtime_tickets',
      'saml_account_links',
      'saml_assertion_replays',
      'sessions',
    ]);
    expect(tables.rows).toEqual(
      allTables.map((relname) => ({
        relname,
        relrowsecurity: withPolicy.includes(relname),
        relforcerowsecurity: withPolicy.includes(relname),
      })),
    );
    expect(policies.rows).toEqual([
      { tablename: 'api_tokens', policyname: 'api_tokens_organization_isolation' },
      {
        tablename: 'authentication_policies',
        policyname: 'authentication_policies_organization_isolation',
      },
      { tablename: 'event_versions', policyname: 'event_versions_organization_isolation' },
      { tablename: 'idempotency_keys', policyname: 'idempotency_keys_organization_isolation' },
      { tablename: 'memberships', policyname: 'memberships_organization_isolation' },
      {
        tablename: 'organization_choices',
        policyname: 'organization_choices_organization_isolation',
      },
      { tablename: 'outbox_events', policyname: 'outbox_events_organization_isolation' },
      { tablename: 'realtime_tickets', policyname: 'realtime_tickets_organization_isolation' },
      { tablename: 'saml_account_links', policyname: 'saml_account_links_organization_isolation' },
      {
        tablename: 'saml_assertion_replays',
        policyname: 'saml_assertion_replays_organization_isolation',
      },
      { tablename: 'sessions', policyname: 'sessions_organization_isolation' },
    ]);
  });

  it('answers the liveness probe without a token', async () => {
    const response = await request(service().getHttpServer()).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok' });
  });

  it('is ready once PostgreSQL answers the application role and NATS the identity user', async () => {
    const response = await request(service().getHttpServer()).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      details: { postgres: { status: 'up' }, nats: { status: 'up' } },
    });
  });

  it('refuses a route of the application without an internal token', async () => {
    const response = await request(service().getHttpServer()).get('/internal/v1/wiring-probe');

    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/u);
    expect(response.body).toMatchObject({ status: 401, code: 'auth.token-missing' });
  });

  it('serves a route to a trusted issuer acting for a member of the organization', async () => {
    const token = await signer.sign('identity-service', {
      actor: { type: 'user', id: camilleMartinId },
      organizationId: atelierNordId,
    });

    const response = await request(service().getHttpServer())
      .get('/internal/v1/wiring-probe')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ reached: true });
  });

  it('refuses a token signed for another service', async () => {
    const token = await signer.sign('document-service', {
      actor: { type: 'user', id: camilleMartinId },
      organizationId: atelierNordId,
    });

    const response = await request(service().getHttpServer())
      .get('/internal/v1/wiring-probe')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      code: 'auth.token-invalid',
      details: { reason: 'audience' },
    });
  });

  describe('notification recipient read', () => {
    const systemActor = { type: 'system', id: 'notification-service' } as const;

    it('returns only the current verified profile from the same account row', async () => {
      const userId = randomUUID();
      const unverifiedId = randomUUID();
      const scheduledId = randomUUID();
      const pendingEmail = `${userId}+pending@example.test`;
      const email = `${userId}@example.test`;
      const system = service().get(SystemTransactionRunner);
      await system.run(async ({ client }) => {
        await client.query(
          `insert into users (id, email, name, email_verified_at, delete_at, language, time_zone, version)
           values ($1, $4, 'Verified fixture', now(), null, 'fr', 'Europe/Paris', 3),
                  ($2, $5, 'Unverified fixture', null, null, 'fr', 'Europe/Paris', 1),
                  ($3, $6, 'Scheduled fixture', now(), now() + interval '1 day', 'fr', 'Europe/Paris', 1)`,
          [
            userId,
            unverifiedId,
            scheduledId,
            email,
            `${unverifiedId}@example.test`,
            `${scheduledId}@example.test`,
          ],
        );
        await client.query(
          'insert into email_changes (user_id, session_id, email) values ($1, $2, $3)',
          [userId, randomUUID(), pendingEmail],
        );
      });
      const auth = await notificationSigner.sign('identity-service', {
        actor: systemActor,
        organizationId: null,
      });
      const read = (id: string) =>
        request(service().getHttpServer())
          .get(`/internal/v1/users/${id}/notification-recipient`)
          .set('Authorization', `Bearer ${auth}`)
          .set('If-None-Match', '*');

      const original = await read(userId);
      const expected = { email, language: 'fr', timeZone: 'Europe/Paris', version: 3 };
      expect(original.status).toBe(200);
      expect(original.headers['cache-control']).toBe('no-store');
      expect(original.body).toEqual(expected);
      expect(GetNotificationRecipientInternalResponse.parse(original.body)).toEqual(expected);

      await system.run(({ client }) =>
        client.query(
          `update users set email = $2, language = 'en', time_zone = 'America/New_York',
           version = version + 1 where id = $1`,
          [userId, pendingEmail],
        ),
      );
      const current = await read(userId);
      expect(current.status).toBe(200);
      expect(current.body).toEqual({
        email: pendingEmail,
        language: 'en',
        timeZone: 'America/New_York',
        version: 4,
      });

      await system.run(({ client }) => client.query('delete from users where id = $1', [userId]));
      for (const id of [userId, unverifiedId, scheduledId, randomUUID()]) {
        const missing = await read(id);
        expect(missing.status).toBe(404);
        expect(missing.headers['cache-control']).toBe('no-store');
        expect(missing.body).toMatchObject({ code: 'user.not-found' });
      }
    });

    it('requires the unscoped Notification system and accepts only the account path', async () => {
      const server = request(service().getHttpServer());
      const path = `/internal/v1/users/${camilleMartinId}/notification-recipient`;
      const auth = await notificationSigner.sign('identity-service', {
        actor: systemActor,
        organizationId: null,
      });
      const gatewayAuth = await signer.sign('identity-service', {
        actor: { type: 'system', id: 'api-gateway' },
        organizationId: null,
      });

      const anonymous = await server.get(path);
      expect(anonymous.status).toBe(401);
      expect(anonymous.headers['cache-control']).toBe('no-store');
      expect(anonymous.body).toMatchObject({ code: 'auth.token-missing' });

      const wrongIssuer = await server.get(path).set('Authorization', `Bearer ${gatewayAuth}`);
      expect(wrongIssuer.status).toBe(403);
      expect(wrongIssuer.headers['cache-control']).toBe('no-store');
      expect(wrongIssuer.body).toMatchObject({ code: 'auth.issuer-not-allowed' });

      for (const claims of [
        { actor: { type: 'user', id: camilleMartinId }, organizationId: null },
        { actor: systemActor, organizationId: atelierNordId },
        { actor: systemActor, organizationId: null, role: 'member' },
        { actor: systemActor, organizationId: null, scopes: ['notifications:read'] },
      ] as const) {
        const scopedAuth = await notificationSigner.sign('identity-service', claims);
        const forbidden = await server.get(path).set('Authorization', `Bearer ${scopedAuth}`);
        expect(forbidden.status).toBe(403);
        expect(forbidden.headers['cache-control']).toBe('no-store');
        expect(forbidden.body).toMatchObject({ code: 'auth.actor-not-allowed' });
      }

      const unexpected = [
        server.get(`${path}?unexpected=1`),
        server.get('/internal/v1/users/invalid/notification-recipient'),
        server.get(path).send({ unexpected: true }),
      ];
      for (const input of unexpected) {
        const malformed = await input.set('Authorization', `Bearer ${auth}`);
        expect(malformed.status).toBe(400);
        expect(malformed.headers['cache-control']).toBe('no-store');
        expect(malformed.body).toMatchObject({ code: 'request.invalid' });
      }
    });

    it('keeps path decoding and parser refusals private at the HTTP boundary', async () => {
      const server = request(service().getHttpServer());
      const path = `/INTERNAL/v1/users/${camilleMartinId}/Notification-Recipient/`;
      const auth = await notificationSigner.sign('identity-service', {
        actor: systemActor,
        organizationId: null,
      });
      const marker = 'private-input-probe';
      const inputs = [
        server.get(`/INTERNAL/v1/users/${marker}%ZZ/Notification-Recipient/`),
        server.get(path).send({ probe: marker + 'x'.repeat(JSON_BODY_LIMIT_BYTES) }),
        server.get(path).set('Content-Type', 'application/json; charset=iso-8859-1').send('{}'),
        server.get(path).set('Content-Type', 'application/json').send(`{"${marker}":`),
      ];

      for (const input of inputs) {
        const refused = await input.set('Authorization', `Bearer ${auth}`);
        expect(refused.status).toBe(400);
        expect(refused.headers['cache-control']).toBe('no-store');
        expect(refused.body).toMatchObject({ code: 'request.invalid' });
        expect(refused.text).not.toContain(marker);
      }

      const head = await server.head(path);
      expect(head.status).toBe(401);
      expect(head.headers['cache-control']).toBe('no-store');
    });
  });

  it('exposes opaque avatar references and emits changes only for committed transitions', async () => {
    const userId = randomUUID();
    const system = service().get(SystemTransactionRunner);
    await system.run(({ client }) =>
      client.query(
        'insert into users (id, name, email, email_verified_at) values ($1, $2, $3, now())',
        [userId, 'Avatar Fixture', `${userId}@example.test`],
      ),
    );
    const token = await signer.sign('identity-service', {
      actor: { type: 'user', id: userId },
      organizationId: atelierNordId,
    });
    const otherToken = await signer.sign('identity-service', {
      actor: { type: 'user', id: camilleMartinId },
      organizationId: null,
    });
    const authorization = `Bearer ${token}`;
    const path = `/internal/v1/users/${userId}`;
    const http = request(service().getHttpServer());
    const unauthenticated = await http.get(`${path}/avatar-reference`);
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.headers['cache-control']).toBe('no-store');
    const malformed = await http
      .post(`${path}/avatar/uploads`)
      .set('Authorization', authorization)
      .set('Content-Type', 'application/json')
      .send('{');
    expect(malformed.status).toBe(400);
    expect(malformed.headers['cache-control']).toBe('no-store');
    expect(malformed.body).toMatchObject({ code: 'request.invalid' });
    const oversized = await http
      .post(`${path}/avatar/uploads`)
      .set('Authorization', authorization)
      .send({ contentType: 'image/png', sizeBytes: 5_242_881 });
    expect(oversized.status).toBe(422);
    expect(oversized.body).toMatchObject({ code: 'media.file-too-large' });
    const unsupported = await http
      .post(`${path}/avatar/uploads`)
      .set('Authorization', authorization)
      .send({ contentType: 'image/svg+xml', sizeBytes: 250 });
    expect(unsupported.status).toBe(422);
    expect(unsupported.body).toMatchObject({ code: 'media.unsupported-type' });
    const reserve = await http
      .post(`${path}/avatar/uploads`)
      .set('Authorization', authorization)
      .set('Idempotency-Key', 'avatar-fixture')
      .send({ contentType: 'image/png', sizeBytes: 250 });
    expect(reserve.status).toBe(201);
    expect(reserve.headers['cache-control']).toBe('no-store');
    const { uploadId, expiresAt } = ReserveAvatarUploadInternalResponse.parse(reserve.body);
    expect(reserve.headers.location).toBe(`${path}/avatar/uploads/${uploadId}`);

    const readUpload = await http
      .get(`${path}/avatar/uploads/${uploadId}`)
      .set('Authorization', authorization)
      .set('If-None-Match', '*');
    expect(readUpload.status).toBe(200);
    expect(readUpload.headers['cache-control']).toBe('no-store');
    expect(readUpload.body).toEqual({ uploadId, expiresAt, state: 'pending' });

    const refused = await http
      .get(`${path}/avatar-reference`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(refused.status).toBe(404);
    expect(refused.headers['cache-control']).toBe('no-store');
    expect(refused.body).toMatchObject({ code: 'user.not-found' });

    const publish = () =>
      http
        .put(`${path}/avatar`)
        .set('Authorization', authorization)
        .set('If-Match', '"1"')
        .send({ uploadId });
    expect((await publish()).headers.etag).toBe('"2"');
    const committedReplay = await publish();
    expect(committedReplay.status).toBe(204);
    expect(committedReplay.headers.etag).toBe('"2"');

    const reference = await http
      .get(`${path}/avatar-reference`)
      .set('Authorization', authorization)
      .set('If-None-Match', '*');
    expect(reference.status).toBe(200);
    expect(reference.headers['cache-control']).toBe('no-store');
    expect(reference.body).toEqual({ assetId: uploadId });
    expect((await http.get(path).set('Authorization', authorization)).body).toMatchObject({
      avatarId: uploadId,
      version: 2,
    });

    const stale = await http
      .delete(`${path}/avatar`)
      .set('Authorization', authorization)
      .set('If-Match', '"1"');
    expect(stale.status).toBe(412);
    expect(stale.body).toMatchObject({ code: 'request.version-mismatch', details: { version: 2 } });

    const remove = () => http.delete(`${path}/avatar`).set('Authorization', authorization);
    expect((await remove()).headers.etag).toBe('"3"');
    expect((await remove()).headers.etag).toBe('"3"');
    const absent = await http.get(`${path}/avatar-reference`).set('Authorization', authorization);
    expect(absent.body).toEqual({ assetId: null });

    const facts = await system.run(({ client }) =>
      client.query(
        `select payload from outbox_events
         where event_name = 'user.avatar-changed.v1' and payload->>'userId' = $1
         order by (payload->>'version')::integer`,
        [userId],
      ),
    );
    const rows = facts.rows as readonly { readonly payload: unknown }[];
    expect(rows.map(({ payload }) => payload)).toEqual([
      expect.objectContaining({
        actor: { type: 'user', id: userId },
        organizationId: null,
        version: 1,
        assetId: uploadId,
        oldAssetId: null,
      }),
      expect.objectContaining({ version: 2, assetId: null, oldAssetId: uploadId }),
    ]);
  });

  it('lets the application role read and write the platform tables of its organization only', async () => {
    const tenant = service().get(TenantTransactionRunner);
    const countAll = async (organizationId: string): Promise<Record<string, number>> =>
      runWithOrganizationContext(memberOf(organizationId), () =>
        tenant.run(async (tx) => {
          const counts = await tx.client.query(
            `select 'outbox_events' as name, count(*)::int as rows from outbox_events
             union all select 'event_versions', count(*)::int from event_versions
             union all select 'idempotency_keys', count(*)::int from idempotency_keys`,
          );
          const rows = counts.rows as readonly { readonly name: string; readonly rows: number }[];
          return Object.fromEntries(rows.map(({ name, rows: count }) => [name, count]));
        }),
      );

    // Sent rather than pending: the relay must have nothing to publish.
    await runWithOrganizationContext(memberOf(atelierNordId), () =>
      tenant.run(async (tx) => {
        await tx.client.query(
          `insert into outbox_events
             (id, event_name, subject, stream, organization_id, payload, status, sent_at)
           values (uuidv7(), 'user.wiring-probe.v1', 'evt.user.wiring-probe.v1', 'EVENTS', $1,
                   '{}', 'sent', now())`,
          [atelierNordId],
        );
        await tx.client.query(
          `insert into event_versions (consumer, organization_id, aggregate_key, version)
           values ('identity-service__wiring-probe', $1, 'user:camille-martin', 1)`,
          [atelierNordId],
        );
        await tx.client.query(
          `update event_versions set version = 2 where aggregate_key = 'user:camille-martin'`,
        );
        await tx.client.query(
          `insert into idempotency_keys
             (organization_id, key, request_fingerprint, response_status, response_headers,
              expires_at)
           values ($1, 'wiring-probe', 'fingerprint', 201, '{}', now() + interval '1 day')`,
          [atelierNordId],
        );
        await tx.client.query(
          `insert into processed_events (consumer, event_id)
           values ('identity-service__wiring-probe', uuidv7())`,
        );
      }),
    );

    expect(await countAll(atelierNordId)).toEqual({
      outbox_events: 1,
      event_versions: 1,
      idempotency_keys: 1,
    });
    expect(await countAll(otherOrganizationId)).toEqual({
      outbox_events: 0,
      event_versions: 0,
      idempotency_keys: 0,
    });
    await expect(
      runWithOrganizationContext(memberOf(otherOrganizationId), () =>
        tenant.run((tx) =>
          tx.client.query(
            `insert into event_versions (consumer, organization_id, aggregate_key, version)
             values ('identity-service__wiring-probe', $1, 'user:wiring-probe', 1)`,
            [atelierNordId],
          ),
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' });

    const deleted = await runWithOrganizationContext(memberOf(atelierNordId), () =>
      tenant.run(async (tx) => {
        const counts: number[] = [];
        for (const table of platformTables) {
          counts.push((await tx.client.query(`delete from ${table} returning 1`)).rows.length);
        }
        return counts;
      }),
    );
    expect(deleted).toEqual([1, 1, 1, 1]);
  });

  it('removes only expired realtime tickets in expiry order within the batch limit', async () => {
    const system = service().get<SystemTransactionRunner>(SystemTransactionRunner);
    const tenant = service().get(TenantTransactionRunner);
    const sessionId: string = randomUUID();
    const memberId: string = randomUUID();
    // Keep the fixtures ahead of the real scheduled worker and use a fixed cutoff in the test.
    const cutoff: Date = new Date(Date.now() + 3_600_000);
    const expired: Date = new Date(cutoff.getTime() - 1_000);
    const live: Date = new Date(cutoff.getTime() + 1_000);

    await system.run(async ({ client }) => {
      await client.query(
        `insert into sessions
           (id, user_id, organization_id, member_id, token_hash, persistent, ip_address,
            last_active_at, expires_at)
         values ($1, $2, $3, $4, repeat('a', 64), false, '192.0.2.1', now(),
                 $5::timestamptz + interval '1 day')`,
        [sessionId, camilleMartinId, atelierNordId, memberId, cutoff],
      );
      await client.query(
        `insert into realtime_tickets
           (token_hash, session_id, user_id, organization_id, member_id, session_version,
            issued_at, expires_at)
         select repeat(digest, 64), $1, $2, $3, $4, 1, expires - interval '30 seconds', expires
           from (values ('b', $5::timestamptz), ('c', $6::timestamptz), ('d', $7::timestamptz))
             as fixture(digest, expires)`,
        [sessionId, camilleMartinId, atelierNordId, memberId, expired, cutoff, live],
      );
    });

    const foreignRows = await runWithOrganizationContext(memberOf(otherOrganizationId), () =>
      tenant.run(async ({ client }): Promise<number> => {
        const { rows } = await client.query(
          'select 1 from realtime_tickets where session_id = $1',
          [sessionId],
        );
        return rows.length;
      }),
    );
    expect(foreignRows).toBe(0);

    const remaining = (): Promise<readonly Date[]> =>
      system.run(async ({ client }): Promise<readonly Date[]> => {
        const { rows } = await client.query(
          'select expires_at from realtime_tickets where session_id = $1 order by expires_at',
          [sessionId],
        );
        return (rows as { readonly expires_at: Date }[]).map(({ expires_at }) => expires_at);
      });
    const cleanup: SystemExpiredRealtimeTicketsUnitOfWork =
      new SystemExpiredRealtimeTicketsUnitOfWork(system);

    await expect(remaining()).resolves.toEqual([expired, cutoff, live]);
    await expect(cleanup.deleteBatch(cutoff, 1)).resolves.toBe(1);
    await expect(remaining()).resolves.toEqual([cutoff, live]);
    await expect(cleanup.deleteBatch(cutoff, 1)).resolves.toBe(1);
    await expect(cleanup.deleteBatch(cutoff, 1)).resolves.toBe(0);
    await expect(remaining()).resolves.toEqual([live]);
  });

  describe('single-use realtime tickets', () => {
    /** Creates an active organization membership and a session with two-step verification. */
    async function ticketFixture(): Promise<{
      readonly organizationId: string;
      readonly userId: string;
      readonly memberId: string;
      readonly sessionId: string;
    }> {
      const organizationId = randomUUID();
      const userId = randomUUID();
      const memberId = randomUUID();
      const sessionId = randomUUID();
      const sessionHash = createHash('sha256').update(randomUUID()).digest('hex');
      const system = service().get(SystemTransactionRunner);
      await system.run(async ({ client }) => {
        await client.query(
          `insert into memberships (id, organization_id, user_id, role, version)
           values ($1, $2, $3, 'member', 1)`,
          [memberId, organizationId, userId],
        );
        await client.query(
          `insert into authentication_policies (organization_id, two_step_verification_required_for)
           values ($1, 'everyone')`,
          [organizationId],
        );
        await client.query(
          'insert into two_step_enrollments (user_id, enabled_at) values ($1, now())',
          [userId],
        );
        await client.query(
          `insert into sessions
             (id, user_id, organization_id, member_id, token_hash, persistent, ip_address,
              last_active_at, expires_at, authenticated_at, two_step_authenticated_at)
           values ($1, $2, $3, $4, $5, false, '192.0.2.1', now(), now() + interval '1 hour',
                   now(), now())`,
          [sessionId, userId, organizationId, memberId, sessionHash],
        );
      });
      return { organizationId, userId, memberId, sessionId };
    }

    it('stores only a digest and allows exactly one concurrent redemption', async () => {
      const fixture = await ticketFixture();
      const issue = service().get(IssueRealtimeTicket);
      const redeem = service().get(RedeemRealtimeTicket);
      const ticket = await issue.execute({
        actorUserId: fixture.userId,
        organizationId: fixture.organizationId,
        sessionId: fixture.sessionId,
      });
      const digest = createHash('sha256').update(ticket.token).digest('hex');
      const stored = await service()
        .get(SystemTransactionRunner)
        .run(({ client }) =>
          client.query(
            'select token_hash, redeemed_at from realtime_tickets where session_id = $1',
            [fixture.sessionId],
          ),
        );
      expect(stored.rows).toEqual([{ token_hash: digest, redeemed_at: null }]);

      const outcomes = await Promise.allSettled([
        redeem.execute({ token: ticket.token }),
        redeem.execute({ token: ticket.token }),
      ]);
      const success = outcomes.filter((result) => result.status === 'fulfilled');
      const failure = outcomes.filter((result) => result.status === 'rejected');
      expect(success).toHaveLength(1);
      expect(failure).toHaveLength(1);
      expect(success[0]).toMatchObject({
        value: {
          userId: fixture.userId,
          organizationId: fixture.organizationId,
          memberId: fixture.memberId,
          sessionId: fixture.sessionId,
          role: 'member',
        },
      });
      const rejected = failure[0];
      expect(
        rejected?.status === 'rejected' && rejected.reason instanceof RealtimeTicketNotFound,
      ).toBe(true);
    });

    it('refuses issuance for another organization or another session actor', async () => {
      const fixture = await ticketFixture();
      const issue = service().get(IssueRealtimeTicket);
      await expect(
        issue.execute({
          actorUserId: fixture.userId,
          organizationId: randomUUID(),
          sessionId: fixture.sessionId,
        }),
      ).rejects.toBeInstanceOf(RealtimeOrganizationNotSelected);
      await expect(
        issue.execute({
          actorUserId: randomUUID(),
          organizationId: fixture.organizationId,
          sessionId: fixture.sessionId,
        }),
      ).rejects.toBeInstanceOf(SessionNotFound);
    });

    it('uses only the selected organization inactivity policy when another organization differs', async () => {
      const fixture = await ticketFixture();
      const system = service().get(SystemTransactionRunner);
      await system.run(async ({ client }) => {
        await client.query(
          `insert into authentication_policies
             (organization_id, session_inactivity_timeout_minutes)
           values ($1, 60)`,
          [randomUUID()],
        );
        await client.query(
          "update sessions set last_active_at = now() - interval '2 hours' where id = $1",
          [fixture.sessionId],
        );
      });
      const issue = service().get(IssueRealtimeTicket);
      const input = {
        actorUserId: fixture.userId,
        organizationId: fixture.organizationId,
        sessionId: fixture.sessionId,
      };
      await expect(issue.execute(input)).resolves.toHaveProperty('expiresAt');
      await system.run(({ client }) =>
        client.query(
          'update authentication_policies set session_inactivity_timeout_minutes = 60 where organization_id = $1',
          [fixture.organizationId],
        ),
      );
      await expect(issue.execute(input)).rejects.toBeInstanceOf(SessionNotFound);
    });

    it('uses the default inactivity limit when the selected organization has no policy', async () => {
      const fixture = await ticketFixture();
      const system = service().get(SystemTransactionRunner);
      await system.run(async ({ client }) => {
        await client.query('delete from authentication_policies where organization_id = $1', [
          fixture.organizationId,
        ]);
        await client.query(
          "update sessions set last_active_at = now() - interval '2 hours' where id = $1",
          [fixture.sessionId],
        );
      });
      const issue = service().get(IssueRealtimeTicket);
      const input = {
        actorUserId: fixture.userId,
        organizationId: fixture.organizationId,
        sessionId: fixture.sessionId,
      };
      await expect(issue.execute(input)).resolves.toHaveProperty('expiresAt');
      await system.run(({ client }) =>
        client.query(
          "update sessions set last_active_at = now() - interval '13 hours' where id = $1",
          [fixture.sessionId],
        ),
      );
      await expect(issue.execute(input)).rejects.toBeInstanceOf(SessionNotFound);
    });

    it.each(['session', 'organization', 'membership', 'two-step', 'expiry'] as const)(
      'refuses redemption after %s changes',
      async (change) => {
        const fixture = await ticketFixture();
        const ticket = await service().get(IssueRealtimeTicket).execute({
          actorUserId: fixture.userId,
          organizationId: fixture.organizationId,
          sessionId: fixture.sessionId,
        });
        await service()
          .get(SystemTransactionRunner)
          .run(async ({ client }) => {
            switch (change) {
              case 'session':
                await client.query('update sessions set revoked_at = now() where id = $1', [
                  fixture.sessionId,
                ]);
                break;
              case 'organization':
                await client.query(
                  'update sessions set organization_id = null, member_id = null, version = version + 1 where id = $1',
                  [fixture.sessionId],
                );
                break;
              case 'membership':
                await client.query('update memberships set removed_at = now() where id = $1', [
                  fixture.memberId,
                ]);
                break;
              case 'two-step':
                await client.query('delete from two_step_enrollments where user_id = $1', [
                  fixture.userId,
                ]);
                break;
              case 'expiry':
                await client.query(
                  `update realtime_tickets
                    set issued_at = date_trunc('milliseconds', now()) - interval '60 seconds',
                        expires_at = date_trunc('milliseconds', now()) - interval '1 millisecond'
                  where session_id = $1`,
                  [fixture.sessionId],
                );
                break;
            }
          });
        await expect(
          service().get(RedeemRealtimeTicket).execute({ token: ticket.token }),
        ).rejects.toBeInstanceOf(RealtimeTicketNotFound);
      },
    );
  });

  it('refuses any change of structure to the application role', async () => {
    const system = service().get(SystemTransactionRunner);
    const statements = [
      'create table wiring_probe (id integer)',
      'alter table outbox_events add column wiring_probe integer',
      'alter table outbox_events no force row level security',
      'drop table processed_events',
      'truncate idempotency_keys',
      'create schema wiring_probe',
    ];

    for (const statement of statements) {
      await expect(system.run((tx) => tx.client.query(statement))).rejects.toMatchObject({
        code: '42501',
      });
    }
  });

  it('provisions the queues of the jobs, which the application role uses without any DDL right', async () => {
    const system = service().get(SystemTransactionRunner);
    const queues = await system.run(
      async (tx) =>
        (
          await tx.client.query(
            "select name from pgboss.queue where left(name, 10) <> '__pgboss__' order by name",
          )
        ).rows as {
          name: string;
        }[],
    );

    expect(queues.map(({ name }) => name)).toEqual([
      'account.avatar-upload-expiry',
      'account.avatar-upload-expiry.dead-letter',
      'account.delete',
      'account.delete.dead-letter',
      'account.deletion-sweep',
      'account.deletion-sweep.dead-letter',
      'account.federation-expiry',
      'account.federation-expiry.dead-letter',
      'session.realtime-ticket-expiry',
      'session.realtime-ticket-expiry.dead-letter',
    ]);
    const federationSchedule = await system.run((tx) =>
      tx.client.query('select cron, timezone from pgboss.schedule where name = $1', [
        'account.federation-expiry',
      ]),
    );
    expect(federationSchedule.rows).toEqual([{ cron: '* * * * *', timezone: 'UTC' }]);
    await expect(
      system.run((tx) => tx.client.query('create table pgboss.wiring_probe (id integer)')),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('keeps the application role out of the migration journal of the drizzle schema', async () => {
    const system = service().get(SystemTransactionRunner);

    // The default privileges of the migrator cover `public` only: a role that could rewrite the
    // journal could make the next migration run apply a migration again.
    await expect(
      system.run((tx) => tx.client.query('delete from drizzle.__drizzle_migrations')),
    ).rejects.toMatchObject({ code: '42501', message: 'permission denied for schema drizzle' });

    const journal = await migrator.query<{ applied: number }>(
      'select count(*)::int as applied from drizzle.__drizzle_migrations',
    );
    expect(journal.rows).toEqual([{ applied: migrationCount }]);
  });

  it('publishes successive outbox events and remains ready', async () => {
    const tenant = service().get(TenantTransactionRunner);
    const system = service().get(SystemTransactionRunner);
    for (let pass = 0; pass < 2; pass += 1) {
      const id = randomUUID();
      await runWithOrganizationContext(memberOf(atelierNordId), () =>
        tenant.run(async (tx) => {
          await tx.client.query(
            `insert into outbox_events
               (id, event_name, subject, stream, organization_id, payload)
             values ($1, 'user.wiring-probe.v1', 'evt.user.wiring-probe.v1', 'EVENTS', $2, $3)`,
            [id, atelierNordId, JSON.stringify({ id, organizationId: atelierNordId })],
          );
        }),
      );
      await vi.waitFor(
        async () => {
          const result = await system.run((tx) =>
            tx.client.query('select status from outbox_events where id = $1', [id]),
          );
          expect(result.rows).toEqual([{ status: 'sent' }]);
        },
        { timeout: 10_000, interval: 100 },
      );
    }
    const response = await request(service().getHttpServer()).get('/health/ready');
    expect(response.status).toBe(200);
  });

  it('runs against a broker that enforces the permissions of cadenway-ops', () => {
    const identity = { NATS_USER: 'identity', NATS_PASSWORD: 'identity' };

    expect(
      brokerAccepts(identity, '--inbox-prefix', '_INBOX.identity', 'stream', 'info', 'EVENTS'),
    ).toBe(true);
    // The restricted stream of the identity events that carry a single-use code or link.
    expect(
      brokerAccepts(
        identity,
        '--inbox-prefix',
        '_INBOX.identity',
        'stream',
        'info',
        'EVENTS_RESTRICTED',
      ),
    ).toBe(true);
    expect(
      brokerAccepts(identity, '--inbox-prefix', '_INBOX.identity', 'stream', 'info', 'EVENTS_DLQ'),
    ).toBe(false);
    expect(brokerAccepts(identity, 'stream', 'info', 'EVENTS')).toBe(false);
    // Its own durable consumers, granted by name: it reads them, and may not delete them.
    const ownConsumer = 'identity-service__project-member-joined';
    expect(
      brokerAccepts(
        identity,
        '--inbox-prefix',
        '_INBOX.identity',
        'consumer',
        'info',
        'EVENTS',
        ownConsumer,
      ),
    ).toBe(true);
    expect(
      brokerAccepts(
        identity,
        '--inbox-prefix',
        '_INBOX.identity',
        'consumer',
        'rm',
        'EVENTS',
        ownConsumer,
        '--force',
      ),
    ).toBe(false);
    expect(brokerAccepts({}, 'consumer', 'info', 'EVENTS', ownConsumer)).toBe(true);
    expect(brokerAccepts(identity, 'pub', 'evt.task.wiring-probe', 'refused')).toBe(false);
    expect(brokerAccepts({ NATS_USER: '', NATS_PASSWORD: '' }, 'pub', 'evt.user.x', 'x')).toBe(
      false,
    );
  });

  it('stops being ready while NATS is down, and is ready again once it is back', async () => {
    compose('stop', 'nats');

    await vi.waitFor(
      async () => {
        const response = await request(service().getHttpServer()).get('/health/ready');
        expect(response.status).toBe(503);
        expect(response.body).toMatchObject({
          status: 'error',
          info: { postgres: { status: 'up' } },
          error: { nats: { status: 'down' } },
        });
      },
      { timeout: 10_000, interval: 250 },
    );

    compose('start', 'nats');

    await vi.waitFor(
      async () => {
        const response = await request(service().getHttpServer()).get('/health/ready');
        expect(response.status).toBe(200);
      },
      { timeout: 30_000, interval: 500 },
    );
  });

  it('stops being ready when its database is down', async () => {
    compose('stop', 'postgres');

    const response = await request(service().getHttpServer()).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: 'error',
      error: { postgres: { status: 'down' } },
    });

    const token = await notificationSigner.sign('identity-service', {
      actor: { type: 'system', id: 'notification-service' },
      organizationId: null,
    });
    const recipient = await request(service().getHttpServer())
      .get(`/internal/v1/users/${camilleMartinId}/notification-recipient`)
      .set('Authorization', `Bearer ${token}`);
    expect(recipient.status).toBe(503);
    expect(recipient.headers['cache-control']).toBe('no-store');
    expect(recipient.body).toMatchObject({ code: 'upstream.unavailable' });
  });

  it('answers 503 on readiness and 200 on liveness as soon as it shuts down', async () => {
    const running = service();
    const closing = running.close();

    await vi.waitFor(
      async () => {
        const response = await request(running.getHttpServer()).get('/health/ready');
        expect(response.status).toBe(503);
        expect(response.body).toMatchObject({
          error: { shutdown: { status: 'down', message: 'shutting down' } },
        });
      },
      { timeout: 5_000, interval: 50 },
    );
    const live = await request(running.getHttpServer()).get('/health/live');
    expect(live.status).toBe(200);

    releaseShutdown();
    await closing;
    app = undefined;
  });
});
