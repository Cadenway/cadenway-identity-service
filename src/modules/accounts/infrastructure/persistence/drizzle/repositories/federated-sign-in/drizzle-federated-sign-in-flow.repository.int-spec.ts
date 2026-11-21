import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { runWithOrganizationContext } from '@cadenway/nest-common';
import { SystemTransactionRunner, TenantTransactionRunner } from '@cadenway/nest-common/database';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FederatedSignInFlow } from '../../../../../domain/aggregates/federated-sign-in/federated-sign-in-flow.aggregate.js';
import { samlAccountLinks } from '../../schemas/federated-sign-in/saml-account-link.schema.js';
import { DrizzleFederatedAccountLinkRepository } from './drizzle-federated-account-link.repository.js';
import { DrizzleFederatedSignInFlowRepository } from './drizzle-federated-sign-in-flow.repository.js';

const composeFile = fileURLToPath(
  new URL('../../../../../../../../compose.dev.yaml', import.meta.url),
);
const migrations = fileURLToPath(new URL('../../../../../../../../migrations', import.meta.url));
const project = `identity-federated-persistence-${String(process.pid)}`;
const organizationId = '01938f6e-6d1a-7c3e-9a51-2f0c4b8d7e10';
const anotherOrganizationId = '01938f6e-0000-7000-8000-000000000072';
const userId = '01938f6e-8a42-7d5b-b2c9-5e1f3a6d9c24';
const anotherUserId = '01938f6e-0000-7000-8000-000000000073';
const flowId = '01938f6e-0000-7000-8000-000000000071';
const stateHash = 'a'.repeat(64);
const browserBindingHash = 'b'.repeat(64);
const receiptHash = 'c'.repeat(64);
const connection = { provider: 'google', issuer: 'https://issuer.example' } as const;
const identity = { ...connection, subject: 'subject-1' } as const;
const saml = {
  provider: 'saml',
  issuer: 'https://sso.example.test',
  subject: 'stable-subject',
  organizationId,
  connectionId: 'directory',
} as const;
const issuedAt = new Date('2026-11-21T12:00:00Z');
const checkedAt = new Date('2026-11-21T12:01:00Z');

function compose(...args: string[]): string {
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

describe('federated sign-in persistence', () => {
  let pool: pg.Pool | undefined;
  let runner: SystemTransactionRunner;
  let tenantRunner: TenantTransactionRunner;

  beforeAll(async () => {
    compose('up', '--detach', '--wait', '--wait-timeout', '120', 'postgres');
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
    tenantRunner = new TenantTransactionRunner(pool);
    await runner.run(({ client }) =>
      client.query(
        `insert into users (id, email, name)
          values ($1, 'camille@example.test', 'Camille'), ($2, 'ines@example.test', 'Inès')`,
        [userId, anotherUserId],
      ),
    );
  });

  afterAll(async () => {
    try {
      await pool?.end();
    } finally {
      compose('down', '--volumes', '--remove-orphans');
    }
  });

  it('uniquely binds a verified identity and leaves a revoked link bound to its account', async () => {
    const first = await runner.run((scope) =>
      new DrizzleFederatedAccountLinkRepository(scope).insert(userId, identity),
    );
    expect(first).not.toBeNull();
    if (first === null) throw new Error('Expected an account link.');
    await expect(
      runner.run((scope) =>
        new DrizzleFederatedAccountLinkRepository(scope).insert(userId, identity),
      ),
    ).resolves.toBeNull();
    await runner.run(async (scope) => {
      const links = new DrizzleFederatedAccountLinkRepository(scope);
      expect(await links.findByIdentity(identity)).toEqual(first);
      expect(await links.findByIdentity({ ...identity, subject: 'SUBJECT-1' })).toBeNull();
      expect(await links.findById(userId, first.id, connection)).toEqual(first);
      expect(await links.revoke(userId, first.id, connection)).toBe(true);
    });
    await expect(
      runner.run((scope) =>
        new DrizzleFederatedAccountLinkRepository(scope).insert(userId, identity),
      ),
    ).resolves.toBeNull();
  });

  it('isolates SAML links by organization and connection and ignores legacy unscoped links', async () => {
    const legacyId = '01938f6e-0000-7000-8000-000000000074';
    const digest = createHash('sha256')
      .update(JSON.stringify([saml.provider, saml.issuer, saml.subject]), 'utf8')
      .digest('hex');
    const otherOrganization = { ...saml, organizationId: anotherOrganizationId };
    const otherConnection = { ...saml, connectionId: 'another-directory' };

    await runner.run(async (scope) => {
      await scope.client.query(
        `insert into federated_account_links (id, user_id, provider, issuer, subject, identity_hash, status)
          values ($1, $2, 'saml', $3, $4, $5, 'active')`,
        [legacyId, anotherUserId, saml.issuer, saml.subject, digest],
      );
      const links = new DrizzleFederatedAccountLinkRepository(scope);
      expect(await links.findByIdentity(saml)).toBeNull();
      expect(await links.findById(anotherUserId, legacyId, saml)).toBeNull();

      const original = await links.insert(userId, saml);
      const otherTenant = await links.insert(anotherUserId, otherOrganization);
      const otherIdp = await links.insert(anotherUserId, otherConnection);
      if (original === null || otherTenant === null || otherIdp === null) {
        throw new Error('Expected independently scoped account links.');
      }
      expect(await links.findByIdentity(saml)).toEqual(original);
      expect(await links.findByIdentity(otherOrganization)).toEqual(otherTenant);
      expect(await links.findByIdentity(otherConnection)).toEqual(otherIdp);
      expect(await links.findById(userId, original.id, otherOrganization)).toBeNull();
      expect(await links.findById(userId, original.id, otherConnection)).toBeNull();
      expect(await links.insert(anotherUserId, saml)).toBeNull();
      expect(await links.revoke(userId, original.id, otherConnection)).toBe(false);
      expect(await links.revoke(userId, original.id, saml)).toBe(true);
      expect(await links.insert(anotherUserId, saml)).toBeNull();
    });

    await runWithOrganizationContext(
      { organizationId, actor: { type: 'user', id: userId }, role: null, scopes: [] },
      () =>
        tenantRunner.run(async (scope) => {
          const visible = await scope.db
            .select({ organizationId: samlAccountLinks.organizationId })
            .from(samlAccountLinks);
          expect(visible).toEqual([{ organizationId }, { organizationId }]);
          expect(() => new DrizzleFederatedAccountLinkRepository(scope)).toThrow(
            'Federated account links require a system transaction.',
          );
        }),
    );
  });

  it('claims once, rolls back an interrupted completion and consumes an authorization refusal', async () => {
    const currentIdentity = { ...identity, subject: 'subject-2' };
    const link = await runner.run((scope) =>
      new DrizzleFederatedAccountLinkRepository(scope).insert(userId, currentIdentity),
    );
    if (link === null) throw new Error('Expected an account link.');
    const flow = FederatedSignInFlow.issue(
      { id: flowId, connection, stateHash, browserBindingHash, persistent: true },
      issuedAt,
    );
    await runner.run((scope) => new DrizzleFederatedSignInFlowRepository(scope).insert(flow));
    await runner.run(async (scope) => {
      expect(
        () =>
          new DrizzleFederatedSignInFlowRepository({
            ...scope,
            kind: 'tenant',
            organizationId,
          }),
      ).toThrow('requires a system transaction');
      const stored = await new DrizzleFederatedSignInFlowRepository(scope).findByStateHash(
        stateHash,
      );
      if (stored === null) throw new Error('Missing flow.');
      expect(() =>
        stored.flow.claim(
          {
            provider: 'google',
            stateHash,
            browserBindingHash: 'd'.repeat(64),
          },
          checkedAt,
        ),
      ).toThrow();
      expect(() =>
        stored.flow.claim(
          {
            provider: 'google',
            stateHash,
            browserBindingHash,
          },
          new Date('2026-11-21T12:10:00Z'),
        ),
      ).toThrow();
    });
    const claim = () =>
      runner.run(async (scope) => {
        const flows = new DrizzleFederatedSignInFlowRepository(scope);
        const stored = await flows.findByStateHash(stateHash);
        if (stored?.flow.snapshot.phase.kind !== 'open') return false;
        return flows.save(
          stored.flow.claim({ provider: 'google', stateHash, browserBindingHash }, checkedAt),
          stored.version,
        );
      });
    expect((await Promise.all([claim(), claim()])).sort()).toEqual([false, true]);
    const complete = async (fail: boolean): Promise<void> =>
      runner.run(async (scope) => {
        const flows = new DrizzleFederatedSignInFlowRepository(scope);
        const stored = await flows.findByStateHash(stateHash);
        if (stored === null) throw new Error('Missing claim.');
        const completed = stored.flow.complete(
          { connection, subject: currentIdentity.subject },
          link,
          receiptHash,
          checkedAt,
        );
        expect(await flows.save(completed, stored.version)).toBe(true);
        if (fail) throw new Error('Rollback test.');
      });
    await expect(complete(true)).rejects.toThrow('Rollback test.');
    await runner.run(async (scope) => {
      const flows = new DrizzleFederatedSignInFlowRepository(scope);
      expect(await flows.findByReceiptHash(receiptHash)).toBeNull();
    });
    await complete(false);
    await runner.run(async (scope) => {
      const flows = new DrizzleFederatedSignInFlowRepository(scope);
      const stored = await flows.findByReceiptHash(receiptHash);
      if (stored === null) throw new Error('Missing receipt.');
      const result = stored.flow.redeem(
        receiptHash,
        {
          account: { id: userId, enabled: true },
          link,
          activeMembership: { organizationId, userId },
          maySignIn: false,
          twoStep: 'not-required',
        },
        checkedAt,
      );
      expect(result.decision).toEqual({ kind: 'refused' });
      expect(await flows.save(result.flow, stored.version)).toBe(true);
      expect(await flows.save(result.flow, stored.version)).toBe(false);
    });
  });
});
