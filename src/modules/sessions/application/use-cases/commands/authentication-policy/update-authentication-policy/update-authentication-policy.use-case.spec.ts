import { beforeEach, describe, expect, it } from 'vitest';

import { AuthenticationPolicy } from '../../../../../domain/aggregates/authentication-policy/authentication-policy.aggregate.js';
import { AuthenticationPolicyRefusal } from '../../../../models/authentication-policy/authentication-policy-refusal.model.js';
import type { OrganizationMember } from '../../../../models/authentication-policy/organization-member.model.js';
import type { OrganizationMembers } from '../../../../ports/outbound/memberships/authentication-policy/organization-members.port.js';
import type { AuthenticationPolicyView } from '../../../../projections/authentication-policy/authentication-policy-view.projection.js';
import { GetAuthenticationPolicy } from '../../../queries/authentication-policy/get-authentication-policy/get-authentication-policy.use-case.js';
import { FixedClock, InMemorySessions } from '../../session/sessions.fixture.js';
import { UpdateAuthenticationPolicy } from './update-authentication-policy.use-case.js';

const ATELIER_NORD: string = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';
const CAMILLE_ID: string = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';
const THEO_ID: string = '019a5f3c-b2c3-7d4e-8f5a-6b7c8d9e0f33';
const LEA_ID: string = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b31';
const SESSION_ID: string = '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60';
const NOW: Date = new Date('2026-11-09T13:24:00Z');

/**
 * Class FakeOrganizationMembers
 *
 * @description
 * The members of Atelier Nord: Camille Martin the owner, Léa an admin, Théo Bernard a member.
 */
class FakeOrganizationMembers implements OrganizationMembers {
  // #region Properties
  /**
   * Property members
   *
   * @description
   * The members.
   *
   * @type {OrganizationMember[]}
   */
  public members: OrganizationMember[] = [
    { userId: CAMILLE_ID, role: 'owner' },
    { userId: LEA_ID, role: 'admin' },
    { userId: THEO_ID, role: 'member' },
  ];
  // #endregion

  // #region Methods
  /**
   * Method roleOf
   *
   * @description
   * The role of a member of Atelier Nord.
   *
   * @param {string} organizationId - The organization.
   * @param {string} userId - The account.
   * @returns {Promise<'owner' | 'admin' | 'member' | 'guest' | null>} Its role, or `null`.
   */
  public roleOf(
    organizationId: string,
    userId: string,
  ): Promise<'owner' | 'admin' | 'member' | 'guest' | null> {
    return Promise.resolve(
      organizationId === ATELIER_NORD
        ? (this.members.find((member: OrganizationMember) => member.userId === userId)?.role ??
            null)
        : null,
    );
  }

  /**
   * Method list
   *
   * @description
   * The members of Atelier Nord.
   *
   * @returns {Promise<readonly OrganizationMember[]>} The members.
   */
  public list(): Promise<readonly OrganizationMember[]> {
    return Promise.resolve(this.members);
  }
  // #endregion
}

describe('UpdateAuthenticationPolicy', () => {
  let store: InMemorySessions;
  let update: UpdateAuthenticationPolicy;
  let get: GetAuthenticationPolicy;

  /**
   * Function putSession
   *
   * @description
   * Stores the session of the request of Camille Martin, acting on Atelier Nord.
   *
   * @param {'password' | 'two-step' | null} method - How its window was opened, `null` for none.
   */
  function putSession(method: 'password' | 'two-step' | null): void {
    store.sessions.set(SESSION_ID, {
      state: {
        id: SESSION_ID,
        userId: CAMILLE_ID,
        persistent: false,
        lastActiveAt: NOW,
        expiresAt: new Date(NOW.getTime() + 30 * 24 * 60 * 60_000),
        revokedAt: null,
        organizationId: ATELIER_NORD,
        memberId: '019a6b10-0000-7000-8000-000000000001',
        version: 2,
        signedInAt: NOW,
        authenticatedAt: method === null ? null : NOW,
        twoStepAuthenticatedAt: method === 'two-step' ? NOW : null,
        inactivityTimeoutMinutes: 720,
      },
      origin: {
        tokenHash: 'hash:camille',
        ipAddress: '192.0.2.14',
        userAgent: null,
        device: { type: 'desktop', browser: null, browserVersion: null, os: null, osVersion: null },
      },
    });
  }

  beforeEach(() => {
    store = new InMemorySessions();
    const members: FakeOrganizationMembers = new FakeOrganizationMembers();
    update = new UpdateAuthenticationPolicy(store, members, new FixedClock(NOW.toISOString()));
    get = new GetAuthenticationPolicy(store, members);
    putSession('two-step');
    store.enrollments.add(CAMILLE_ID);
  });

  it('reads the default policy with the members without two-step verification', async () => {
    await expect(
      get.execute({ actorUserId: CAMILLE_ID, organizationId: ATELIER_NORD }),
    ).resolves.toEqual({
      twoStepVerificationRequiredFor: 'nobody',
      sessionInactivityTimeoutMinutes: 720,
      adminsWithoutTwoStepVerification: 1,
      membersWithoutTwoStepVerification: 2,
      version: 1,
    });
  });

  it('requires two-step verification of the admins with the next version', async () => {
    const view: AuthenticationPolicyView = await update.execute({
      actorUserId: CAMILLE_ID,
      organizationId: ATELIER_NORD,
      sessionId: SESSION_ID,
      expectedVersions: [1],
      twoStepVerificationRequiredFor: 'admins',
    });

    expect(view).toMatchObject({ twoStepVerificationRequiredFor: 'admins', version: 2 });
    expect(store.policies.get(ATELIER_NORD)?.snapshot.version).toBe(2);
  });

  it('answers the same version and writes nothing for a patch that moves nothing', async () => {
    const view: AuthenticationPolicyView = await update.execute({
      actorUserId: CAMILLE_ID,
      organizationId: ATELIER_NORD,
      sessionId: SESSION_ID,
      expectedVersions: null,
      sessionInactivityTimeoutMinutes: 720,
    });

    expect(view.version).toBe(1);
    expect(store.policies.size).toBe(0);
  });

  it('refuses a member, a guest or a stranger before anything else', async () => {
    await expect(
      update.execute({
        actorUserId: THEO_ID,
        organizationId: ATELIER_NORD,
        sessionId: SESSION_ID,
        expectedVersions: [9],
      }),
    ).rejects.toMatchObject({ reason: 'role-forbidden' });
    await expect(
      update.execute({
        actorUserId: '019a5f3c-0000-7000-8000-000000000099',
        organizationId: ATELIER_NORD,
        sessionId: SESSION_ID,
        expectedVersions: null,
      }),
    ).rejects.toMatchObject({ reason: 'organization-not-found' });
  });

  it('checks If-Match before the two-step verification of the actor and the recent authentication', async () => {
    putSession(null);
    store.enrollments.delete(CAMILLE_ID);

    await expect(
      update.execute({
        actorUserId: CAMILLE_ID,
        organizationId: ATELIER_NORD,
        sessionId: SESSION_ID,
        expectedVersions: [7],
        twoStepVerificationRequiredFor: 'everyone',
      }),
    ).rejects.toMatchObject({ reason: 'version-mismatch', version: 1 });
  });

  it('refuses to require two-step verification of a role the actor has, without it, before the recent authentication', async () => {
    putSession(null);
    store.enrollments.delete(CAMILLE_ID);

    await expect(
      update.execute({
        actorUserId: CAMILLE_ID,
        organizationId: ATELIER_NORD,
        sessionId: SESSION_ID,
        expectedVersions: null,
        twoStepVerificationRequiredFor: 'admins',
      }),
    ).rejects.toMatchObject({ reason: 'two-step-not-enabled' });
  });

  it('refuses a window opened by a password for an actor with two-step verification', async () => {
    putSession('password');

    const refusal: unknown = await update
      .execute({
        actorUserId: CAMILLE_ID,
        organizationId: ATELIER_NORD,
        sessionId: SESSION_ID,
        expectedVersions: null,
        sessionInactivityTimeoutMinutes: 60,
      })
      .catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(AuthenticationPolicyRefusal);
    expect(refusal).toMatchObject({
      reason: 'reauthentication-required',
      twoStepVerificationEnabled: true,
    });
    expect(store.policies.get(ATELIER_NORD)).toBeUndefined();
  });

  it('answers session-not-found for a session that is not an open session of the actor', async () => {
    store.policies.set(
      ATELIER_NORD,
      AuthenticationPolicy.defaultFor(ATELIER_NORD).apply({ sessionInactivityTimeoutMinutes: 60 }),
    );
    store.sessions.clear();

    await expect(
      update.execute({
        actorUserId: CAMILLE_ID,
        organizationId: ATELIER_NORD,
        sessionId: SESSION_ID,
        expectedVersions: [2],
        sessionInactivityTimeoutMinutes: 720,
      }),
    ).rejects.toMatchObject({ reason: 'session-not-found' });
  });
});
