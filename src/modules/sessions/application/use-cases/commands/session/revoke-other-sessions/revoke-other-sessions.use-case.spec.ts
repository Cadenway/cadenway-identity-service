import { beforeEach, describe, expect, it } from 'vitest';

import { AuthenticationPolicy } from '../../../../../domain/aggregates/authentication-policy/authentication-policy.aggregate.js';
import type { SessionState } from '../../../../../domain/value-objects/session/session-state.value-object.js';
import { SessionNotFound } from '../../../../models/session/session-not-found.model.js';
import { RevokeOtherSessions } from './revoke-other-sessions.use-case.js';
import { FixedClock, InMemorySessions } from '../sessions.fixture.js';

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
 * Constant LEA_ID
 *
 * @description
 * Id of the account of another member of Atelier Nord.
 *
 * @type {string}
 */
const LEA_ID: string = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b31';

/**
 * Constant NOW
 *
 * @description
 * The instant of the specs.
 *
 * @type {Date}
 */
const NOW: Date = new Date('2026-11-09T13:24:00Z');

/**
 * Constant FIREFOX
 *
 * @description
 * The `User-Agent` of the computer of Camille Martin.
 *
 * @type {string}
 */
const FIREFOX: string =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0';

/**
 * Function put
 *
 * @description
 * Stores a session opened at `NOW` unless `changes` say otherwise, recently authenticated by its
 * sign-in.
 *
 * @param {InMemorySessions} store - The fake sessions.
 * @param {string} id - Id of the session.
 * @param {string} userId - Its person.
 * @param {Partial<SessionState>} changes - Members that differ.
 * @param {string | null} userAgent - The `User-Agent` of its browser.
 */
function put(
  store: InMemorySessions,
  id: string,
  userId: string,
  changes: Partial<SessionState> = {},
  userAgent: string | null = FIREFOX,
): void {
  const signedInAt: Date = changes.signedInAt ?? NOW;
  store.sessions.set(id, {
    state: {
      id,
      userId,
      persistent: false,
      lastActiveAt: signedInAt,
      expiresAt: new Date(signedInAt.getTime() + 30 * 24 * 60 * 60_000),
      revokedAt: null,
      organizationId: null,
      memberId: null,
      version: 1,
      signedInAt,
      authenticatedAt: signedInAt,
      twoStepAuthenticatedAt: null,
      inactivityTimeoutMinutes: 720,
      ...changes,
    },
    origin: {
      tokenHash: `hash:${id}`,
      ipAddress: '192.0.2.14',
      userAgent,
      device: {
        type: 'desktop',
        browser: 'Firefox',
        browserVersion: '132',
        os: 'Windows',
        osVersion: null,
      },
    },
  });
}

/**
 * Function sessionId
 *
 * @description
 * A session id of the specs.
 *
 * @param {number} index - Its rank.
 * @returns {string} The id.
 */
function sessionId(index: number): string {
  return `019a6a2e-4b1c-7d3e-8f5a-${String(index).padStart(12, '0')}`;
}

describe('RevokeOtherSessions', () => {
  let store: InMemorySessions;
  let revokeOthers: RevokeOtherSessions;

  beforeEach(() => {
    store = new InMemorySessions();
    revokeOthers = new RevokeOtherSessions(store, new FixedClock('2026-11-09T13:24:00Z'));
    put(store, sessionId(1), CAMILLE_ID);
    put(store, sessionId(2), CAMILLE_ID);
    put(store, sessionId(3), CAMILLE_ID);
    put(store, sessionId(4), LEA_ID);
  });

  it('closes every other session of the person and says how many', async () => {
    await expect(
      revokeOthers.execute({ actorUserId: CAMILLE_ID, sessionId: sessionId(1) }),
    ).resolves.toEqual({ revokedCount: 2 });

    expect(store.sessions.get(sessionId(1))?.state.revokedAt).toBeNull();
    expect(store.sessions.get(sessionId(4))?.state.revokedAt).toBeNull();
    expect(store.revoked.map(({ session }) => session.id)).toEqual([sessionId(2), sessionId(3)]);
  });

  it('also closes, silently and uncounted, a session idle beyond the inactivity of its organization', async () => {
    put(store, sessionId(5), CAMILLE_ID, {
      organizationId: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f',
      memberId: '019a6b10-0000-7000-8000-000000000001',
      lastActiveAt: new Date('2026-11-09T11:00:00Z'),
      signedInAt: new Date('2026-11-09T11:00:00Z'),
      inactivityTimeoutMinutes: 60,
    });
    store.policies.set(
      '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f',
      AuthenticationPolicy.defaultFor('019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f').apply({
        sessionInactivityTimeoutMinutes: 60,
      }),
    );

    await expect(
      revokeOthers.execute({ actorUserId: CAMILLE_ID, sessionId: sessionId(1) }),
    ).resolves.toEqual({ revokedCount: 2 });

    expect(store.sessions.get(sessionId(5))?.state.revokedAt).toEqual(NOW);
    expect(store.revoked.map(({ session }) => session.id)).toEqual([sessionId(2), sessionId(3)]);
  });

  it('answers 0 when the session of the request is the only one', async () => {
    await expect(
      revokeOthers.execute({ actorUserId: LEA_ID, sessionId: sessionId(4) }),
    ).resolves.toEqual({ revokedCount: 0 });
  });

  it('refuses a session of another person, an ended one or an unknown one, and revokes nothing', async () => {
    put(store, sessionId(5), CAMILLE_ID, { revokedAt: new Date('2026-11-09T13:00:00Z') });
    for (const id of [sessionId(4), sessionId(5), sessionId(9)]) {
      await expect(
        revokeOthers.execute({ actorUserId: CAMILLE_ID, sessionId: id }),
      ).rejects.toThrow(SessionNotFound);
    }
    expect(store.revoked).toEqual([]);
  });
});
