import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthenticationPolicy } from '../../../../../domain/aggregates/authentication-policy/authentication-policy.aggregate.js';
import type { ActiveMembership } from '../../../../models/session/active-membership.model.js';
import type { OpenSessionOutput } from '../open-session/open-session.output.js';
import { OpenSession } from '../open-session/open-session.use-case.js';
import { RevokeSession } from '../revoke-session/revoke-session.use-case.js';
import { SwitchSessionOrganization } from '../switch-session-organization/switch-session-organization.use-case.js';
import {
  FakeActiveMemberships,
  FakeDeviceReader,
  FakeSessionTokens,
  FixedClock,
  InMemorySessions,
} from '../sessions.fixture.js';
import { IntrospectToken } from './introspect-token.use-case.js';

/**
 * Constant CAMILLE_ID
 *
 * @description
 * Id of the account of Camille Martin.
 *
 * @type {string}
 */
const CAMILLE_ID: string = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';

/**
 * Constant HOUR
 *
 * @description
 * One hour, in milliseconds.
 *
 * @type {number}
 */
const HOUR: number = 60 * 60_000;

const ATELIER_NORD = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';
const MEMBER_ID = '019a6b10-0000-7000-8000-000000000001';
const ANOTHER_ORGANIZATION = '019a6b10-0000-7000-8000-000000000004';
const EVERY_SCOPE = ['tasks:read', 'tasks:write', 'members:read', 'webhooks:manage'];

describe('IntrospectToken', () => {
  let store: InMemorySessions;
  let clock: FixedClock;
  let introspect: IntrospectToken;
  let opened: OpenSessionOutput;
  let memberships: FakeActiveMemberships;
  let tokens: FakeSessionTokens;

  beforeEach(async () => {
    store = new InMemorySessions();
    clock = new FixedClock('2026-11-08T13:07:00Z');
    tokens = new FakeSessionTokens();
    memberships = new FakeActiveMemberships();
    introspect = new IntrospectToken(store, tokens, memberships, clock);
    opened = await new OpenSession(
      store,
      tokens,
      new FakeDeviceReader(),
      memberships,
      clock,
    ).execute({
      userId: CAMILLE_ID,
      persistent: false,
      client: { ipAddress: '86.247.12.30', userAgent: null },
      authentication: 'password',
      newDeviceNotice: null,
    });
  });

  it('answers an active session with its subject and its absolute expiry', async () => {
    await expect(introspect.execute({ token: opened.token })).resolves.toEqual({
      active: true,
      tokenType: 'session',
      sessionId: opened.id,
      userId: CAMILLE_ID,
      organizationId: null,
      role: null,
      scopes: EVERY_SCOPE,
      expiresAt: new Date('2026-12-08T13:07:00Z'),
      withheldOrganizationId: null,
    });
  });

  it('answers the current organization and the role of the account there', async () => {
    memberships.join(CAMILLE_ID, {
      memberId: MEMBER_ID,
      organizationId: ATELIER_NORD,
      role: 'admin',
    });
    await new SwitchSessionOrganization(store, memberships, clock).execute({
      actorUserId: CAMILLE_ID,
      sessionId: opened.id,
      organizationId: ATELIER_NORD,
    });
    memberships.join(CAMILLE_ID, {
      memberId: MEMBER_ID,
      organizationId: ATELIER_NORD,
      role: 'guest',
    });

    await expect(introspect.execute({ token: opened.token })).resolves.toMatchObject({
      active: true,
      organizationId: ATELIER_NORD,
      role: 'guest',
      scopes: EVERY_SCOPE,
    });
  });

  it('withholds the organization of an admin without two-step verification once the policy requires it, keeping the scopes', async () => {
    memberships.join(CAMILLE_ID, {
      memberId: MEMBER_ID,
      organizationId: ATELIER_NORD,
      role: 'admin',
    });
    await new SwitchSessionOrganization(store, memberships, clock).execute({
      actorUserId: CAMILLE_ID,
      sessionId: opened.id,
      organizationId: ATELIER_NORD,
    });
    store.policies.set(
      ATELIER_NORD,
      AuthenticationPolicy.defaultFor(ATELIER_NORD).apply({
        twoStepVerificationRequiredFor: 'admins',
      }),
    );

    await expect(introspect.execute({ token: opened.token })).resolves.toMatchObject({
      active: true,
      organizationId: null,
      role: null,
      scopes: EVERY_SCOPE,
      withheldOrganizationId: ATELIER_NORD,
    });
    store.enrollments.add(CAMILLE_ID);
    await expect(introspect.execute({ token: opened.token })).resolves.toMatchObject({
      organizationId: ATELIER_NORD,
      role: 'admin',
      withheldOrganizationId: null,
    });
  });

  it('closes a session after the inactivity of the policy of its organization', async () => {
    memberships.join(CAMILLE_ID, {
      memberId: MEMBER_ID,
      organizationId: ATELIER_NORD,
      role: 'admin',
    });
    await new SwitchSessionOrganization(store, memberships, clock).execute({
      actorUserId: CAMILLE_ID,
      sessionId: opened.id,
      organizationId: ATELIER_NORD,
    });
    store.policies.set(
      ATELIER_NORD,
      AuthenticationPolicy.defaultFor(ATELIER_NORD).apply({ sessionInactivityTimeoutMinutes: 60 }),
    );
    clock.advance(HOUR);

    await expect(introspect.execute({ token: opened.token })).resolves.toEqual({ active: false });
  });

  it('answers no organization once the account was removed from it, even if it joined again', async () => {
    memberships.join(CAMILLE_ID, {
      memberId: MEMBER_ID,
      organizationId: ATELIER_NORD,
      role: 'member',
    });
    await new SwitchSessionOrganization(store, memberships, clock).execute({
      actorUserId: CAMILLE_ID,
      sessionId: opened.id,
      organizationId: ATELIER_NORD,
    });

    memberships.remove(CAMILLE_ID, ATELIER_NORD);
    await expect(introspect.execute({ token: opened.token })).resolves.toMatchObject({
      active: true,
      organizationId: null,
      role: null,
    });

    memberships.join(CAMILLE_ID, {
      memberId: '019a6b10-0000-7000-8000-000000000002',
      organizationId: ATELIER_NORD,
      role: 'member',
    });
    await expect(introspect.execute({ token: opened.token })).resolves.toMatchObject({
      active: true,
      organizationId: null,
      role: null,
    });
  });

  it('answers inactive for a malformed or unknown token', async () => {
    await expect(introspect.execute({ token: 'short' })).resolves.toEqual({ active: false });
    await expect(introspect.execute({ token: 'U'.repeat(43) })).resolves.toEqual({
      active: false,
    });
  });

  it('counts an active answer as activity, written at most once a minute', async () => {
    clock.advance(30_000);
    await introspect.execute({ token: opened.token });
    expect(store.activityWrites).toBe(0);

    clock.advance(11 * HOUR);
    await introspect.execute({ token: opened.token });
    await introspect.execute({ token: opened.token });
    expect(store.activityWrites).toBe(1);

    clock.advance(11 * HOUR);
    await expect(introspect.execute({ token: opened.token })).resolves.toMatchObject({
      active: true,
    });
  });

  it('answers inactive after 12 hours without activity', async () => {
    clock.advance(12 * HOUR);

    await expect(introspect.execute({ token: opened.token })).resolves.toEqual({ active: false });
  });

  it('answers inactive once the session is revoked', async () => {
    await new RevokeSession(store, clock).execute({
      actorUserId: CAMILLE_ID,
      sessionId: opened.id,
    });

    await expect(introspect.execute({ token: opened.token })).resolves.toEqual({ active: false });
  });

  describe('with current membership proofs', () => {
    const proof = { memberId: MEMBER_ID, organizationId: ATELIER_NORD, role: 'guest' } as const;
    const find =
      vi.fn<(organizationId: string, userId: string) => Promise<ActiveMembership | null>>();

    beforeEach(async () => {
      find.mockReset();
      find.mockResolvedValue(proof);
      memberships.join(CAMILLE_ID, { ...proof, role: 'owner' });
      await new SwitchSessionOrganization(store, memberships, clock).execute({
        actorUserId: CAMILLE_ID,
        sessionId: opened.id,
        organizationId: ATELIER_NORD,
      });
      introspect = new IntrospectToken(store, tokens, memberships, clock, { find });
    });

    it('uses the current lower role even while the projection still grants ownership', async () => {
      await expect(introspect.execute({ token: opened.token })).resolves.toMatchObject({
        active: true,
        organizationId: ATELIER_NORD,
        role: 'guest',
      });
      expect(find).toHaveBeenCalledExactlyOnceWith(ATELIER_NORD, CAMILLE_ID);
    });

    it('withholds the current organization when the proven role requires MFA', async () => {
      store.policies.set(
        ATELIER_NORD,
        AuthenticationPolicy.defaultFor(ATELIER_NORD).apply({
          twoStepVerificationRequiredFor: 'everyone',
        }),
      );
      await expect(introspect.execute({ token: opened.token })).resolves.toMatchObject({
        active: true,
        organizationId: null,
        role: null,
        withheldOrganizationId: ATELIER_NORD,
      });
    });

    it.each([
      ['removal', null],
      ['rejoining', { ...proof, memberId: '019a6b10-0000-7000-8000-000000000002' }],
    ] as const)('drops the original member scope after %s', async (_case, membership) => {
      find.mockResolvedValueOnce(membership);
      await expect(introspect.execute({ token: opened.token })).resolves.toMatchObject({
        active: true,
        organizationId: null,
        role: null,
      });
    });

    it('propagates an unavailable authority and uses the intact selection on recovery', async () => {
      const unavailable = new Error('organization.unavailable');
      find.mockRejectedValueOnce(unavailable);
      clock.advance(60_000);
      await expect(introspect.execute({ token: opened.token })).rejects.toBe(unavailable);
      expect(store.activityWrites).toBe(0);
      await expect(introspect.execute({ token: opened.token })).resolves.toMatchObject({
        active: true,
        organizationId: ATELIER_NORD,
        role: 'guest',
      });
    });

    it('does not lend an old proof to a concurrent selection', async () => {
      const next = {
        organizationId: ANOTHER_ORGANIZATION,
        memberId: '019a6b10-0000-7000-8000-000000000005',
        role: 'guest',
      } as const;
      memberships.join(CAMILLE_ID, next);
      find.mockImplementationOnce(async () => {
        await new SwitchSessionOrganization(store, memberships, clock).execute({
          actorUserId: CAMILLE_ID,
          sessionId: opened.id,
          organizationId: ANOTHER_ORGANIZATION,
        });
        return proof;
      });
      await expect(introspect.execute({ token: opened.token })).resolves.toMatchObject({
        active: true,
        organizationId: null,
        role: null,
      });
      find.mockResolvedValueOnce(next);
      await expect(introspect.execute({ token: opened.token })).resolves.toMatchObject({
        active: true,
        organizationId: ANOTHER_ORGANIZATION,
      });
    });

    it('rejects a local revocation during the authority request', async () => {
      find.mockImplementationOnce(async () => {
        await new RevokeSession(store, clock).execute({
          actorUserId: CAMILLE_ID,
          sessionId: opened.id,
        });
        return proof;
      });
      await expect(introspect.execute({ token: opened.token })).resolves.toEqual({ active: false });
    });
  });
});
