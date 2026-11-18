import { beforeEach, describe, expect, it } from 'vitest';

import type { SessionState } from '../../../../../domain/value-objects/session/session-state.value-object.js';
import { EndRecentAuthentication } from './end-recent-authentication.use-case.js';
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

describe('EndRecentAuthentication', () => {
  let store: InMemorySessions;
  let end: EndRecentAuthentication;

  beforeEach(() => {
    store = new InMemorySessions();
    end = new EndRecentAuthentication(store, new FixedClock('2026-11-09T13:24:00Z'));
    put(store, sessionId(1), CAMILLE_ID);
    put(store, sessionId(2), CAMILLE_ID);
    put(store, sessionId(3), LEA_ID);
  });

  it('ends the recent authentication of the other sessions of the person, keeping one', async () => {
    await end.execute({ userId: CAMILLE_ID, exceptSessionId: sessionId(1), scope: 'every-window' });

    expect(store.sessions.get(sessionId(1))?.state.authenticatedAt).toEqual(NOW);
    expect(store.sessions.get(sessionId(2))?.state.authenticatedAt).toBeNull();
    expect(store.sessions.get(sessionId(3))?.state.authenticatedAt).toEqual(NOW);
    expect(store.revoked).toEqual([]);
  });

  it('ends it in every session of the person when none is kept, as a reset does', async () => {
    await end.execute({ userId: CAMILLE_ID, exceptSessionId: null, scope: 'every-window' });

    expect(store.sessions.get(sessionId(1))?.state.authenticatedAt).toBeNull();
    expect(store.sessions.get(sessionId(2))?.state.authenticatedAt).toBeNull();
  });
});
