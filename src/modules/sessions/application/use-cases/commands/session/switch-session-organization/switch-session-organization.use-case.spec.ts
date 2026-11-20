import { beforeEach, describe, expect, it } from 'vitest';

import { OrganizationMfaRequired } from '../../../../models/session/organization-mfa-required.model.js';
import { OrganizationNotFound } from '../../../../models/session/organization-not-found.model.js';
import { SessionNotFound } from '../../../../models/session/session-not-found.model.js';
import { AuthenticationPolicy } from '../../../../../domain/aggregates/authentication-policy/authentication-policy.aggregate.js';
import type { OpenSessionOutput } from '../open-session/open-session.output.js';
import { OpenSession } from '../open-session/open-session.use-case.js';
import { RevokeSession } from '../revoke-session/revoke-session.use-case.js';
import {
  FakeActiveMemberships,
  FakeDeviceReader,
  FakeSessionTokens,
  FixedClock,
  InMemorySessions,
} from '../sessions.fixture.js';
import { SwitchSessionOrganization } from './switch-session-organization.use-case.js';

const CAMILLE_ID = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';
const LEA_ID = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b31';
const ATELIER_NORD = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';
const OTHER_ORGANIZATION = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2e';
const MEMBER_ID = '019a6b10-0000-7000-8000-000000000001';
const NEXT_MEMBER_ID = '019a6b10-0000-7000-8000-000000000002';

describe('SwitchSessionOrganization', () => {
  let store: InMemorySessions;
  let memberships: FakeActiveMemberships;
  let clock: FixedClock;
  let switchOrganization: SwitchSessionOrganization;
  let opened: OpenSessionOutput;

  beforeEach(async () => {
    store = new InMemorySessions();
    memberships = new FakeActiveMemberships();
    clock = new FixedClock('2026-11-08T13:07:00Z');
    switchOrganization = new SwitchSessionOrganization(store, memberships, clock);
    opened = await new OpenSession(
      store,
      new FakeSessionTokens(),
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
    memberships.join(CAMILLE_ID, {
      memberId: MEMBER_ID,
      organizationId: ATELIER_NORD,
      role: 'owner',
    });
  });

  it('moves the session to an organization of the actor and remembers it for the next ones', async () => {
    await expect(
      switchOrganization.execute({
        actorUserId: CAMILLE_ID,
        sessionId: opened.id,
        organizationId: ATELIER_NORD,
      }),
    ).resolves.toEqual({ organizationId: ATELIER_NORD, role: 'owner' });

    expect(store.sessions.get(opened.id)?.state).toMatchObject({
      organizationId: ATELIER_NORD,
      memberId: MEMBER_ID,
      version: 2,
    });
    expect(store.choices.get(CAMILLE_ID)).toBe(ATELIER_NORD);
    expect(store.organizationChanges.map((session) => session.snapshot.version)).toEqual([2]);
  });

  it('leaves the session unchanged for its current organization, which stays the last choice', async () => {
    const input = { actorUserId: CAMILLE_ID, sessionId: opened.id, organizationId: ATELIER_NORD };
    await switchOrganization.execute(input);
    store.choices.set(CAMILLE_ID, OTHER_ORGANIZATION);

    await expect(switchOrganization.execute(input)).resolves.toEqual({
      organizationId: ATELIER_NORD,
      role: 'owner',
    });
    expect(store.sessions.get(opened.id)?.state.version).toBe(2);
    expect(store.choices.get(CAMILLE_ID)).toBe(ATELIER_NORD);
    expect(store.organizationChanges).toHaveLength(1);
  });

  it('appends the next session version if the membership changes within the same organization', async () => {
    const input = { actorUserId: CAMILLE_ID, sessionId: opened.id, organizationId: ATELIER_NORD };
    await switchOrganization.execute(input);
    memberships.join(CAMILLE_ID, {
      memberId: NEXT_MEMBER_ID,
      organizationId: ATELIER_NORD,
      role: 'guest',
    });

    await expect(switchOrganization.execute(input)).resolves.toEqual({
      organizationId: ATELIER_NORD,
      role: 'guest',
    });
    expect(store.organizationChanges.map((session) => session.snapshot.version)).toEqual([2, 3]);
    expect(store.organizationChanges[1]?.snapshot.memberId).toBe(NEXT_MEMBER_ID);
  });

  it('refuses an organization the actor is not a member of, and changes nothing', async () => {
    await expect(
      switchOrganization.execute({
        actorUserId: CAMILLE_ID,
        sessionId: opened.id,
        organizationId: OTHER_ORGANIZATION,
      }),
    ).rejects.toThrow(OrganizationNotFound);

    expect(store.sessions.get(opened.id)?.state).toMatchObject({
      organizationId: null,
      version: 1,
    });
    expect(store.choices.size).toBe(0);
    expect(store.organizationChanges).toEqual([]);
  });

  it('refuses a session of another user, an unknown one and one that ended', async () => {
    await expect(
      switchOrganization.execute({
        actorUserId: LEA_ID,
        sessionId: opened.id,
        organizationId: ATELIER_NORD,
      }),
    ).rejects.toThrow(SessionNotFound);
    await expect(
      switchOrganization.execute({
        actorUserId: CAMILLE_ID,
        sessionId: '019a6a2e-4b1c-7d3e-8f5a-ffffffffffff',
        organizationId: ATELIER_NORD,
      }),
    ).rejects.toThrow(SessionNotFound);

    await new RevokeSession(store, clock).execute({
      actorUserId: CAMILLE_ID,
      sessionId: opened.id,
    });
    await expect(
      switchOrganization.execute({
        actorUserId: CAMILLE_ID,
        sessionId: opened.id,
        organizationId: ATELIER_NORD,
      }),
    ).rejects.toThrow(SessionNotFound);
  });
  it('refuses an organization that requires two-step verification of the actor, and changes nothing', async () => {
    store.policies.set(
      ATELIER_NORD,
      AuthenticationPolicy.defaultFor(ATELIER_NORD).apply({
        twoStepVerificationRequiredFor: 'admins',
      }),
    );

    const refusal: unknown = await switchOrganization
      .execute({ actorUserId: CAMILLE_ID, sessionId: opened.id, organizationId: ATELIER_NORD })
      .catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(OrganizationMfaRequired);
    expect(refusal).toMatchObject({ organizationId: ATELIER_NORD });
    expect(store.sessions.get(opened.id)?.state).toMatchObject({
      organizationId: null,
      version: 1,
    });
    expect(store.choices.has(CAMILLE_ID)).toBe(false);
    store.enrollments.add(CAMILLE_ID);
    await expect(
      switchOrganization.execute({
        actorUserId: CAMILLE_ID,
        sessionId: opened.id,
        organizationId: ATELIER_NORD,
      }),
    ).resolves.toEqual({ organizationId: ATELIER_NORD, role: 'owner' });
  });

  it('closes, without an event, a session idle for longer than the inactivity of the organization chosen', async () => {
    store.policies.set(
      ATELIER_NORD,
      AuthenticationPolicy.defaultFor(ATELIER_NORD).apply({ sessionInactivityTimeoutMinutes: 60 }),
    );
    clock.advance(2 * 60 * 60_000);

    await expect(
      switchOrganization.execute({
        actorUserId: CAMILLE_ID,
        sessionId: opened.id,
        organizationId: ATELIER_NORD,
      }),
    ).rejects.toThrow(SessionNotFound);
    expect(store.sessions.get(opened.id)?.state.revokedAt).not.toBeNull();
    expect(store.revoked).toEqual([]);
    expect(store.organizationChanges).toEqual([]);
    expect(store.choices.has(CAMILLE_ID)).toBe(false);
  });
});
