import { execFileSync } from 'node:child_process';
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto';
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
import { FindActiveMembership } from '../src/modules/memberships/public/membership/find-active-membership.js';
import { SystemSessionsUnitOfWork } from '../src/modules/sessions/infrastructure/persistence/drizzle/transactions/session/system-sessions.unit-of-work.js';
import { OpenSession } from '../src/modules/sessions/public/session/open-session.js';

// The organization context of P2b on the service as main.ts assembles it, against a disposable
// PostgreSQL and NATS started from compose.dev.yaml (see service-wiring.int-spec.ts): the copy of
// the memberships fed by member events published to EVENTS as organization-service would, the
// choice of the current organization of a session, the introspection with and without an
// organization, a new session starting in the last organization chosen, and the lifecycle of a
// personal API token. Member events are published with the `admin` user of the `nats-streams`
// container, since the `identity` user may not publish on `evt.member.>`. Instants that a rule
// compares (an expiry, the last use of a token) are moved back in the database, never waited for.

/** Compose file of the development dependencies. */
const composeFile: string = fileURLToPath(new URL('../compose.dev.yaml', import.meta.url));

/** Throwaway project name, distinct from the other specs and from any developer stack. */
const project = `cadenway-identity-service-organization-test-${String(process.pid)}`;

/** Atelier Nord, the organization of the mockup. */
const atelierNord = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';

/** Another organization, which Camille Martin joins later. */
const studioSud = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b40';

/** An organization nobody of these specs belongs to. */
const elsewhere = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b41';

/** The accounts of the specs, people of the mockup. */
const people = {
  camille: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
  ines: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b31',
  hugo: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b32',
  marc: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b33',
  lea: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b34',
} as const;

/** The memberships of the specs, as organization-service ids them. */
const members = {
  camilleAtelierNord: '019a6b10-0000-7000-8000-00000000000a',
  inesAtelierNord: '019a6b10-0000-7000-8000-00000000000b',
  hugoAtelierNord: '019a6b10-0000-7000-8000-00000000000c',
  marcAtelierNord: '019a6b10-0000-7000-8000-00000000000d',
  leaStudioSud: '019a6b10-0000-7000-8000-00000000000e',
  camilleStudioSud: '019a6b10-0000-7000-8000-00000000000f',
  camilleStudioSudAgain: '019a6b10-0000-7000-8000-000000000010',
} as const;

/** Every scope, which a session holds. */
const everyScope = ['tasks:read', 'tasks:write', 'members:read', 'webhooks:manage'];

/** The browser of the contract's examples. */
const client = {
  ipAddress: '86.247.12.30',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0',
} as const;

/** Every secret the run handled: session tokens and API token secrets. */
const secrets: string[] = [];

/** Every log line the application wrote. */
const logLines: string[] = [];

/** The member events published so far, by their own id, to publish one again. */
const published = new Map<string, { readonly subject: string; readonly body: string }>();

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
 * Publishes a message to JetStream with the `admin` user of the `nats-streams` container, waiting
 * for the acknowledgement of the stream.
 *
 * @param subject - The subject.
 * @param body - The JSON body.
 * @param messageId - The `Nats-Msg-Id`, distinct for a second delivery of the same event.
 */
function publish(subject: string, body: string, messageId: string): void {
  compose(
    'exec',
    '-T',
    'nats-streams',
    'nats',
    'pub',
    '--jetstream',
    '--header',
    `Nats-Msg-Id:${messageId}`,
    subject,
    body,
  );
}

/** A member event as organization-service emits it. */
interface MemberEvent {
  readonly kind: 'joined' | 'role-changed' | 'removed';
  readonly organizationId: string;
  readonly memberId: string;
  readonly userId: string;
  readonly role: 'owner' | 'admin' | 'member' | 'guest';
  readonly version: number;
}

/**
 * Publishes a member event on its `evt.` subject, as the outbox relay of organization-service does.
 *
 * @param event - The event.
 * @returns The id of the event.
 */
function publishMemberEvent(event: MemberEvent): string {
  const id = randomUUID();
  const payload: Record<string, unknown> = {
    id,
    occurredAt: new Date().toISOString(),
    organizationId: event.organizationId,
    actor: { type: 'user', id: event.userId },
    version: event.version,
    memberId: event.memberId,
    userId: event.userId,
    role: event.role,
    ...(event.kind === 'joined' ? { invitationId: null } : {}),
    ...(event.kind === 'role-changed' ? { previousRole: 'member' } : {}),
  };
  const subject = `evt.member.${event.kind}.v1`;
  const body = JSON.stringify(payload);
  published.set(id, { subject, body });
  publish(subject, body, id);
  return id;
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

describe('identity-service organization context', () => {
  const apiGateway = keyPair('test-api-gateway');
  let app: NestExpressApplication;
  let gateway: InternalTokenSigner;
  let migrator: pg.Pool;
  const early: { inesJoined: string } = { inesJoined: '' };

  /** The claims of the introspections: the gateway acting as itself. */
  const system: InternalTokenClaims = {
    actor: { type: 'system', id: 'api-gateway' },
    organizationId: null,
  };

  /**
   * The claims of a signed-in user, with the current organization of its session when it has one.
   *
   * @param userId - Id of the user.
   * @param organizationId - The current organization, or `null`.
   * @returns The claims.
   */
  function user(userId: string, organizationId: string | null = null): InternalTokenClaims {
    return organizationId === null
      ? { actor: { type: 'user', id: userId }, organizationId: null }
      : {
          actor: { type: 'user', id: userId },
          organizationId,
          role: 'member',
          scopes: everyScope,
        };
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
   * Reads the copy of a membership.
   *
   * @param memberId - The membership.
   * @returns Its row, or `undefined` before its first event arrived.
   */
  async function membership(
    memberId: string,
  ): Promise<
    | { role: string; version: number; removed: boolean; updated_at: Date; user_id: string }
    | undefined
  > {
    const rows = await systemQuery<{
      role: string;
      version: number;
      removed: boolean;
      updated_at: Date;
      user_id: string;
    }>(
      `select role, version, removed_at is not null as removed, updated_at, user_id
         from memberships where id = $1`,
      [memberId],
    );
    return rows[0];
  }

  /**
   * Waits until the copy of a membership matches.
   *
   * @param memberId - The membership.
   * @param expected - The members it must have.
   */
  async function untilMembership(memberId: string, expected: object): Promise<void> {
    await vi.waitFor(
      async () => {
        expect(await membership(memberId)).toMatchObject(expected);
      },
      {
        timeout: 20_000,
        interval: 200,
      },
    );
  }

  /**
   * Opens a session of a user, as a sign-in does.
   *
   * @param userId - The user.
   * @returns The id of the session and its token.
   */
  async function openSession(userId: string): Promise<{ id: string; token: string }> {
    const opened = await app
      .get(OpenSession, { strict: false })
      .execute({ userId, persistent: false, client });
    secrets.push(opened.token);
    return { id: opened.id, token: opened.token };
  }

  /**
   * Introspects a session token.
   *
   * @param token - The token.
   * @returns The body of the introspection.
   */
  async function introspect(token: string): Promise<Record<string, unknown>> {
    return (await call('post', '/internal/v1/tokens/introspect', system, { token })).body as Record<
      string,
      unknown
    >;
  }

  /**
   * Introspects a personal API token.
   *
   * @param token - The token.
   * @returns The body of the introspection.
   */
  async function introspectApiToken(token: string): Promise<Record<string, unknown>> {
    return (await call('post', '/internal/v1/api-tokens/introspect', system, { token }))
      .body as Record<string, unknown>;
  }

  /**
   * Chooses the current organization of a session.
   *
   * @param userId - The user of the session.
   * @param sessionId - The session.
   * @param organizationId - The organization.
   * @returns The response.
   */
  async function choose(
    userId: string,
    sessionId: string,
    organizationId: string,
  ): Promise<Response> {
    return call('put', `/internal/v1/sessions/${sessionId}/organization`, user(userId), {
      organizationId,
    });
  }

  /**
   * Creates a personal API token in the current organization of a session.
   *
   * @param userId - The user.
   * @param organizationId - The current organization of the session.
   * @param body - Name, scopes and expiration.
   * @returns The response.
   */
  async function createToken(
    userId: string,
    organizationId: string,
    body: object = { name: 'Synchronisation GitLab', scopes: ['tasks:read'] },
  ): Promise<Response> {
    const response = await call(
      'post',
      '/internal/v1/api-tokens',
      user(userId, organizationId),
      body,
    );
    const secret = (response.body as { secret?: unknown }).secret;
    if (typeof secret === 'string') {
      secrets.push(secret);
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

    // Published before the service starts: its new consumers read what the stream already holds.
    publishMemberEvent({
      kind: 'joined',
      organizationId: atelierNord,
      memberId: members.camilleAtelierNord,
      userId: people.camille,
      role: 'owner',
      version: 1,
    });
    early.inesJoined = publishMemberEvent({
      kind: 'joined',
      organizationId: atelierNord,
      memberId: members.inesAtelierNord,
      userId: people.ines,
      role: 'member',
      version: 1,
    });

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
    vi.stubEnv('PASSWORD_PEPPER', 'integration-test-password-pepper-organization-00');

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
      vi.unstubAllEnvs();
      compose('down', '--volumes', '--remove-orphans');
    }
  });

  describe('the copy of the memberships', () => {
    it('holds the memberships published before the service started', async () => {
      await untilMembership(members.camilleAtelierNord, {
        role: 'owner',
        version: 1,
        removed: false,
        user_id: people.camille,
      });
      await untilMembership(members.inesAtelierNord, {
        role: 'member',
        version: 1,
        removed: false,
      });
    });

    it('applies the events of a membership by version, whatever their order of arrival', async () => {
      const hugo = {
        organizationId: atelierNord,
        memberId: members.hugoAtelierNord,
        userId: people.hugo,
      } as const;
      publishMemberEvent({ ...hugo, kind: 'role-changed', role: 'admin', version: 3 });
      publishMemberEvent({ ...hugo, kind: 'joined', role: 'member', version: 1 });
      publishMemberEvent({ ...hugo, kind: 'role-changed', role: 'guest', version: 2 });

      await untilMembership(members.hugoAtelierNord, { role: 'admin', version: 3, removed: false });
      // The two older events are applied, or skipped, after the newest: nothing moves back.
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      expect(await membership(members.hugoAtelierNord)).toMatchObject({
        role: 'admin',
        version: 3,
        removed: false,
      });
    });

    it('keeps a removal after a role change, even when the older events arrive after it', async () => {
      const marc = {
        organizationId: atelierNord,
        memberId: members.marcAtelierNord,
        userId: people.marc,
      } as const;
      publishMemberEvent({ ...marc, kind: 'removed', role: 'admin', version: 3 });
      publishMemberEvent({ ...marc, kind: 'role-changed', role: 'admin', version: 2 });
      publishMemberEvent({ ...marc, kind: 'joined', role: 'member', version: 1 });

      await untilMembership(members.marcAtelierNord, { removed: true, version: 3 });
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      expect(await membership(members.marcAtelierNord)).toMatchObject({
        removed: true,
        version: 3,
      });
      await expect(
        app
          .get(FindActiveMembership, { strict: false })
          .execute({ organizationId: atelierNord, userId: people.marc }),
      ).resolves.toBeNull();
    });

    it('applies a redelivered event once', async () => {
      const before = await membership(members.inesAtelierNord);
      const original = published.get(early.inesJoined);
      if (original === undefined || before === undefined) {
        throw new Error('The join of Inès Robert was not published or not applied.');
      }

      publish(original.subject, original.body, `${early.inesJoined}-redelivered`);
      // A later event on the same subject: one consumer handles one message at a time, in order.
      publishMemberEvent({
        kind: 'joined',
        organizationId: studioSud,
        memberId: members.leaStudioSud,
        userId: people.lea,
        role: 'owner',
        version: 1,
      });
      await untilMembership(members.leaStudioSud, { role: 'owner', version: 1 });

      expect(await membership(members.inesAtelierNord)).toEqual(before);
      const processed = await systemQuery<{ count: number }>(
        `select count(*)::int as count from processed_events
          where consumer = 'identity-service__project-member-joined' and event_id = $1`,
        [early.inesJoined],
      );
      expect(processed).toEqual([{ count: 1 }]);
    });
  });

  describe('the current organization of a session', () => {
    const camille: { first: { id: string; token: string } } = { first: { id: '', token: '' } };

    it('introspects a session without an organization, with every scope', async () => {
      camille.first = await openSession(people.camille);

      expect(await introspect(camille.first.token)).toEqual({
        active: true,
        tokenType: 'session',
        sessionId: camille.first.id,
        userId: people.camille,
        organizationId: null,
        role: null,
        scopes: everyScope,
        expiresAt: expect.any(String) as unknown,
      });
    });

    it('moves a session to an organization of the user, which the introspection then carries', async () => {
      const response = await choose(people.camille, camille.first.id, atelierNord);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ organizationId: atelierNord, role: 'owner' });
      expect(await introspect(camille.first.token)).toMatchObject({
        active: true,
        organizationId: atelierNord,
        role: 'owner',
        scopes: everyScope,
      });
      expect((await choose(people.camille, camille.first.id, atelierNord)).body).toEqual({
        organizationId: atelierNord,
        role: 'owner',
      });
    });

    it('refuses an organization the user is not a member of, or was removed from', async () => {
      const outsider = await choose(people.camille, camille.first.id, elsewhere);
      const marc = await openSession(people.marc);
      const removed = await choose(people.marc, marc.id, atelierNord);

      for (const response of [outsider, removed]) {
        expect(response.status).toBe(404);
        expect(response.body).toMatchObject({ code: 'organization.not-found' });
      }
      expect(await introspect(camille.first.token)).toMatchObject({ organizationId: atelierNord });
    });

    it('refuses a session of another user, an unknown one, and a body without an organization', async () => {
      const other = await choose(people.ines, camille.first.id, atelierNord);
      const unknown = await choose(
        people.camille,
        '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60',
        atelierNord,
      );
      const invalid = await call(
        'put',
        `/internal/v1/sessions/${camille.first.id}/organization`,
        user(people.camille),
        {},
      );

      expect(other.status).toBe(404);
      expect(other.body).toMatchObject({ code: 'session.not-found' });
      expect(unknown.status).toBe(404);
      expect(unknown.body).toMatchObject({ code: 'session.not-found' });
      expect(invalid.status).toBe(400);
      expect(invalid.body).toMatchObject({ code: 'request.invalid' });
    });

    it('answers 404 until the membership arrives, then moves the session', async () => {
      expect((await choose(people.camille, camille.first.id, studioSud)).status).toBe(404);

      publishMemberEvent({
        kind: 'joined',
        organizationId: studioSud,
        memberId: members.camilleStudioSud,
        userId: people.camille,
        role: 'member',
        version: 1,
      });
      await vi.waitFor(
        async () => {
          expect((await choose(people.camille, camille.first.id, studioSud)).status).toBe(200);
        },
        { timeout: 20_000, interval: 250 },
      );
      expect(await introspect(camille.first.token)).toMatchObject({
        organizationId: studioSud,
        role: 'member',
      });
    });

    it('starts a new session in the organization the user chose last', async () => {
      const second = await openSession(people.camille);

      expect(await introspect(second.token)).toMatchObject({
        active: true,
        organizationId: studioSud,
        role: 'member',
      });
    });

    it('empties the organization of the sessions of a removed member, for good', async () => {
      const second = await openSession(people.camille);
      publishMemberEvent({
        kind: 'removed',
        organizationId: studioSud,
        memberId: members.camilleStudioSud,
        userId: people.camille,
        role: 'member',
        version: 2,
      });
      await untilMembership(members.camilleStudioSud, { removed: true });

      for (const token of [camille.first.token, second.token]) {
        expect(await introspect(token)).toMatchObject({
          active: true,
          organizationId: null,
          role: null,
        });
      }
      expect(await introspect((await openSession(people.camille)).token)).toMatchObject({
        organizationId: null,
      });

      // Invited again, a new membership: the sessions stay without an organization until one is
      // chosen, and a new session starts there again, since the person is a member of it.
      publishMemberEvent({
        kind: 'joined',
        organizationId: studioSud,
        memberId: members.camilleStudioSudAgain,
        userId: people.camille,
        role: 'guest',
        version: 1,
      });
      await untilMembership(members.camilleStudioSudAgain, { removed: false });
      expect(await introspect(camille.first.token)).toMatchObject({ organizationId: null });
      expect(await introspect((await openSession(people.camille)).token)).toMatchObject({
        organizationId: studioSud,
        role: 'guest',
      });
    });

    it('rolls back the choice and the session it moved when the work fails', async () => {
      const session = await openSession(people.ines);
      const unitOfWork = new SystemSessionsUnitOfWork(
        app.get(SystemTransactionRunner),
        app.get(OutboxWriter),
        app.get(OutboxRelay),
      );
      const outboxBefore = await systemQuery<{ count: number }>(
        'select count(*)::int as count from outbox_events',
      );

      await expect(
        unitOfWork.run(async (store) => {
          const loaded = await store.sessions.findForUpdate(session.id);
          if (loaded === null) {
            throw new Error('The session of Inès Robert is missing.');
          }
          await store.sessions.chooseOrganization(
            loaded.chooseOrganization(
              { organizationId: atelierNord, memberId: members.inesAtelierNord },
              new Date(),
            ),
          );
          await store.organizationChoices.remember(people.ines, atelierNord);
          throw new Error('the work fails after its writes');
        }),
      ).rejects.toThrow('the work fails after its writes');

      expect(
        await systemQuery('select organization_id, version from sessions where id = $1', [
          session.id,
        ]),
      ).toEqual([{ organization_id: null, version: 1 }]);
      expect(
        await systemQuery('select user_id from organization_choices where user_id = $1', [
          people.ines,
        ]),
      ).toEqual([]);
      expect(
        await systemQuery<{ count: number }>('select count(*)::int as count from outbox_events'),
      ).toEqual(outboxBefore);
    });
  });

  describe('personal API tokens', () => {
    const ines: { secret: string; id: string } = { secret: '', id: '' };

    it('creates a token in the current organization and returns its secret once', async () => {
      const response = await createToken(people.ines, atelierNord, {
        name: '  Synchronisation GitLab ',
        scopes: ['tasks:read', 'tasks:read'],
      });
      const body = response.body as {
        apiToken: { id: string; createdAt: string; expiresAt: string };
        secret: string;
      };

      expect(response.status).toBe(201);
      expect(response.headers.location).toBe(`/internal/v1/api-tokens/${body.apiToken.id}`);
      expect(body).toEqual({
        apiToken: {
          id: expect.any(String) as unknown,
          name: 'Synchronisation GitLab',
          prefix: body.secret.slice(0, 11),
          scopes: ['tasks:read'],
          organizationId: atelierNord,
          createdAt: expect.any(String) as unknown,
          expiresAt: expect.any(String) as unknown,
          lastUsedAt: null,
        },
        secret: expect.stringMatching(/^cw_pat_[0-9A-Za-z]{36}$/u) as unknown,
      });
      expect(Date.parse(body.apiToken.expiresAt) - Date.parse(body.apiToken.createdAt)).toBe(
        30 * 24 * 60 * 60_000,
      );
      const stored = await systemQuery<Record<string, unknown>>(
        'select * from api_tokens where id = $1',
        [body.apiToken.id],
      );
      expect(stored).toEqual([
        expect.objectContaining({
          user_id: people.ines,
          organization_id: atelierNord,
          prefix: body.secret.slice(0, 11),
          token_hash: createHash('sha256').update(body.secret).digest('hex'),
        }),
      ]);
      expect(JSON.stringify(stored)).not.toContain(body.secret);
      ines.secret = body.secret;
      ines.id = body.apiToken.id;
    });

    it('refuses a route of a session without an organization, or called by the system', async () => {
      const withoutOrganization = await call('post', '/internal/v1/api-tokens', user(people.ines), {
        name: 'CI',
        scopes: ['tasks:read'],
      });
      const asSystem = await call('get', '/internal/v1/api-tokens', {
        ...system,
        organizationId: atelierNord,
      });
      const blank = await createToken(people.ines, atelierNord, {
        name: '   ',
        scopes: ['tasks:read'],
      });

      expect(withoutOrganization.status).toBe(403);
      expect(withoutOrganization.body).toMatchObject({ code: 'auth.organization-required' });
      expect(asSystem.status).toBe(403);
      expect(asSystem.body).toMatchObject({ code: 'auth.actor-not-allowed' });
      expect(blank.status).toBe(400);
      expect(blank.body).toMatchObject({ code: 'request.invalid' });
    });

    it('introspects an active token with its user, organization, role and scopes', async () => {
      expect(await introspectApiToken(ines.secret)).toEqual({
        active: true,
        tokenType: 'api-token',
        apiTokenId: ines.id,
        userId: people.ines,
        organizationId: atelierNord,
        role: 'member',
        scopes: ['tasks:read'],
        expiresAt: expect.any(String) as unknown,
      });
    });

    it('records the last use at most once a minute', async () => {
      const lastUsed = async (): Promise<Date | null> =>
        (
          await systemQuery<{ last_used_at: Date | null }>(
            'select last_used_at from api_tokens where id = $1',
            [ines.id],
          )
        )[0]?.last_used_at ?? null;
      const first = await lastUsed();
      expect(first).not.toBeNull();

      await introspectApiToken(ines.secret);
      expect(await lastUsed()).toEqual(first);

      await systemQuery(
        `update api_tokens set last_used_at = last_used_at - interval '61 seconds' where id = $1`,
        [ines.id],
      );
      const movedBack = await lastUsed();
      await introspectApiToken(ines.secret);
      expect((await lastUsed())?.getTime()).toBeGreaterThan(movedBack?.getTime() ?? 0);
    });

    it('lists the active tokens of the caller, a page at a time, never with their secret', async () => {
      const second = await createToken(people.ines, atelierNord, {
        name: 'Zapier',
        scopes: ['members:read'],
        expiration: 'never',
      });
      const secondId = (second.body as { apiToken: { id: string } }).apiToken.id;
      await createToken(people.camille, atelierNord);

      const first = await call(
        'get',
        '/internal/v1/api-tokens?limit=1',
        user(people.ines, atelierNord),
      );
      const cursor = (first.body as { nextCursor: string }).nextCursor;
      const next = await call(
        'get',
        `/internal/v1/api-tokens?limit=1&cursor=${encodeURIComponent(cursor)}`,
        user(people.ines, atelierNord),
      );
      const elsewhereList = await call(
        'get',
        '/internal/v1/api-tokens',
        user(people.ines, studioSud),
      );
      const invalid = await call(
        'get',
        '/internal/v1/api-tokens?cursor=not-a-cursor',
        user(people.ines, atelierNord),
      );

      expect(first.status).toBe(200);
      expect(first.body).toEqual({
        items: [
          expect.objectContaining({ id: secondId, expiresAt: null, scopes: ['members:read'] }),
        ],
        nextCursor: expect.any(String) as unknown,
      });
      expect(next.body).toEqual({
        items: [
          expect.objectContaining({ id: ines.id, lastUsedAt: expect.any(String) as unknown }),
        ],
        nextCursor: null,
      });
      expect(JSON.stringify([first.body, next.body])).not.toContain('"secret"');
      expect(JSON.stringify([first.body, next.body])).not.toContain(ines.secret);
      expect(elsewhereList.body).toEqual({ items: [], nextCursor: null });
      expect(invalid.status).toBe(400);
      expect(invalid.body).toMatchObject({ code: 'request.invalid' });
    });

    it('revokes a token: inactive from the next introspection, 204 again, 404 for another user', async () => {
      const otherUser = await call(
        'delete',
        `/internal/v1/api-tokens/${ines.id}`,
        user(people.camille, atelierNord),
      );
      const otherOrganization = await call(
        'delete',
        `/internal/v1/api-tokens/${ines.id}`,
        user(people.ines, studioSud),
      );
      const revoked = await call(
        'delete',
        `/internal/v1/api-tokens/${ines.id}`,
        user(people.ines, atelierNord),
      );
      const again = await call(
        'delete',
        `/internal/v1/api-tokens/${ines.id}`,
        user(people.ines, atelierNord),
      );

      for (const response of [otherUser, otherOrganization]) {
        expect(response.status).toBe(404);
        expect(response.body).toMatchObject({ code: 'api-token.not-found' });
      }
      expect(revoked.status).toBe(204);
      expect(again.status).toBe(204);
      expect(await introspectApiToken(ines.secret)).toEqual({ active: false });
      const list = await call('get', '/internal/v1/api-tokens', user(people.ines, atelierNord));
      expect((list.body as { items: { id: string }[] }).items.map(({ id }) => id)).not.toContain(
        ines.id,
      );
    });

    it('answers inactive for an expired token, a malformed one and a session token', async () => {
      const created = await createToken(people.ines, atelierNord);
      const { apiToken, secret } = created.body as { apiToken: { id: string }; secret: string };
      await systemQuery(
        `update api_tokens set expires_at = now() - interval '1 second' where id = $1`,
        [apiToken.id],
      );
      const session = await openSession(people.ines);

      expect(await introspectApiToken(secret)).toEqual({ active: false });
      expect(
        await introspectApiToken(`${secret.slice(0, -1)}${secret.endsWith('0') ? '1' : '0'}`),
      ).toEqual({
        active: false,
      });
      expect(await introspectApiToken(session.token)).toEqual({ active: false });
      expect(await introspect(secret)).toEqual({ active: false });
    });

    it('answers inactive once the user is no longer a member of the organization of the token', async () => {
      const created = await createToken(people.hugo, atelierNord);
      const { secret } = created.body as { secret: string };
      expect(await introspectApiToken(secret)).toMatchObject({ active: true, role: 'admin' });

      publishMemberEvent({
        kind: 'removed',
        organizationId: atelierNord,
        memberId: members.hugoAtelierNord,
        userId: people.hugo,
        role: 'admin',
        version: 4,
      });
      await untilMembership(members.hugoAtelierNord, { removed: true });

      expect(await introspectApiToken(secret)).toEqual({ active: false });
    });
  });

  describe('the logs', () => {
    it('never hold a session token nor an API token secret', () => {
      expect(logLines.length).toBeGreaterThan(20);
      expect(secrets.length).toBeGreaterThan(10);
      const leaks = logLines.filter((line) => secrets.some((secret) => line.includes(secret)));

      expect(leaks).toEqual([]);
    });
  });
});
