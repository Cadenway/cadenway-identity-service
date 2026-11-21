import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActiveMembership } from '../../../../models/api-token/active-membership.model.js';
import {
  FakeActiveMemberships,
  FakeApiTokenSecrets,
  FakeOrganizationAccess,
  FakeRecentAuthentications,
  FixedClock,
  InMemoryApiTokens,
} from '../api-tokens.fixture.js';
import type { CreateApiTokenOutput } from '../create-api-token/create-api-token.output.js';
import { CreateApiToken } from '../create-api-token/create-api-token.use-case.js';
import { RevokeApiToken } from '../revoke-api-token/revoke-api-token.use-case.js';
import { IntrospectApiToken } from './introspect-api-token.use-case.js';

const ATELIER_NORD = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';
const CAMILLE_ID = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';
const SESSION_ID = '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60';
const DAY = 24 * 60 * 60_000;

describe('IntrospectApiToken', () => {
  let store: InMemoryApiTokens;
  let memberships: FakeActiveMemberships;
  let access: FakeOrganizationAccess;
  let clock: FixedClock;
  let introspect: IntrospectApiToken;
  let created: CreateApiTokenOutput;
  let secrets: FakeApiTokenSecrets;

  beforeEach(async () => {
    store = new InMemoryApiTokens();
    memberships = new FakeActiveMemberships();
    clock = new FixedClock('2026-11-08T14:02:00Z');
    secrets = new FakeApiTokenSecrets();
    access = new FakeOrganizationAccess();
    introspect = new IntrospectApiToken(store, secrets, memberships, clock, access);
    created = await new CreateApiToken(
      store,
      secrets,
      new FakeRecentAuthentications('recent'),
      clock,
    ).execute({
      actorUserId: CAMILLE_ID,
      organizationId: ATELIER_NORD,
      sessionId: SESSION_ID,
      name: 'Synchronisation GitLab',
      scopes: ['tasks:read', 'members:read'],
      expiration: '30-days',
    });
    memberships.join(CAMILLE_ID, {
      memberId: '019a6b10-0000-7000-8000-000000000001',
      organizationId: ATELIER_NORD,
      role: 'member',
    });
  });

  it('answers an active token with its user, organization, role, scopes and expiry', async () => {
    await expect(introspect.execute({ token: created.secret })).resolves.toEqual({
      active: true,
      tokenType: 'api-token',
      apiTokenId: created.apiToken.id,
      userId: CAMILLE_ID,
      organizationId: ATELIER_NORD,
      role: 'member',
      scopes: ['tasks:read', 'members:read'],
      expiresAt: new Date('2026-12-08T14:02:00Z'),
      withheldOrganizationId: null,
    });
  });

  it('keeps a token active but acting on nothing while its organization is withheld', async () => {
    access.withheldFrom.add(`${ATELIER_NORD}/${CAMILLE_ID}`);

    await expect(introspect.execute({ token: created.secret })).resolves.toMatchObject({
      active: true,
      organizationId: ATELIER_NORD,
      role: 'member',
      scopes: [],
      withheldOrganizationId: ATELIER_NORD,
    });
  });

  it('records the use at most once a minute', async () => {
    await introspect.execute({ token: created.secret });
    clock.advance(59_000);
    await introspect.execute({ token: created.secret });
    expect(store.useWrites).toBe(1);

    clock.advance(1_000);
    await introspect.execute({ token: created.secret });
    expect(store.useWrites).toBe(2);
    expect(store.rows.get(created.apiToken.id)?.state.lastUsedAt).toEqual(
      new Date('2026-11-08T14:03:00Z'),
    );
  });

  it('answers inactive for a malformed or unknown token, and a session token', async () => {
    for (const token of ['short', `cw_pat_${'x'.repeat(36)}`, 'U'.repeat(43)]) {
      await expect(introspect.execute({ token })).resolves.toEqual({ active: false });
    }
  });

  it('answers inactive once revoked, once expired, and once the user left the organization', async () => {
    memberships.active.clear();
    await expect(introspect.execute({ token: created.secret })).resolves.toEqual({ active: false });
    expect(store.useWrites).toBe(0);

    memberships.join(CAMILLE_ID, {
      memberId: '019a6b10-0000-7000-8000-000000000001',
      organizationId: ATELIER_NORD,
      role: 'member',
    });
    clock.advance(30 * DAY);
    await expect(introspect.execute({ token: created.secret })).resolves.toEqual({ active: false });

    clock.advance(-30 * DAY);
    await new RevokeApiToken(store, clock).execute({
      actorUserId: CAMILLE_ID,
      organizationId: ATELIER_NORD,
      apiTokenId: created.apiToken.id,
    });
    await expect(introspect.execute({ token: created.secret })).resolves.toEqual({ active: false });
  });

  describe('with current membership proofs', () => {
    const proof = {
      organizationId: ATELIER_NORD,
      memberId: '019a6b10-0000-7000-8000-000000000001',
      role: 'guest',
    } as const;
    const find =
      vi.fn<(organizationId: string, userId: string) => Promise<ActiveMembership | null>>();

    beforeEach(() => {
      find.mockReset();
      find.mockResolvedValue(proof);
      introspect = new IntrospectApiToken(store, secrets, memberships, clock, access, { find });
    });

    it('uses the current role independently of the projection', async () => {
      await expect(introspect.execute({ token: created.secret })).resolves.toMatchObject({
        active: true,
        organizationId: ATELIER_NORD,
        role: 'guest',
      });
      expect(find).toHaveBeenCalledExactlyOnceWith(ATELIER_NORD, CAMILLE_ID);
    });

    it('removes scope on confirmed removal and can resume for a new membership', async () => {
      find.mockResolvedValueOnce(null).mockResolvedValueOnce({
        ...proof,
        memberId: '019a6b10-0000-7000-8000-000000000002',
      });
      await expect(introspect.execute({ token: created.secret })).resolves.toEqual({
        active: false,
      });
      expect(store.useWrites).toBe(0);
      await expect(introspect.execute({ token: created.secret })).resolves.toMatchObject({
        active: true,
        organizationId: ATELIER_NORD,
        role: 'guest',
      });
    });

    it('does not fall back to projected access during an outage', async () => {
      const unavailable = new Error('organization.unavailable');
      find.mockRejectedValueOnce(unavailable);
      await expect(introspect.execute({ token: created.secret })).rejects.toBe(unavailable);
      expect(store.useWrites).toBe(0);
      await expect(introspect.execute({ token: created.secret })).resolves.toMatchObject({
        active: true,
        role: 'guest',
      });
    });

    it('rejects a local revocation during the authority request', async () => {
      find.mockImplementationOnce(async () => {
        await new RevokeApiToken(store, clock).execute({
          actorUserId: CAMILLE_ID,
          organizationId: ATELIER_NORD,
          apiTokenId: created.apiToken.id,
        });
        return proof;
      });
      await expect(introspect.execute({ token: created.secret })).resolves.toEqual({
        active: false,
      });
    });

    it('performs no authority call for an unrecognized secret', async () => {
      await expect(introspect.execute({ token: 'malformed' })).resolves.toEqual({ active: false });
      expect(find).not.toHaveBeenCalled();
    });
  });
});
