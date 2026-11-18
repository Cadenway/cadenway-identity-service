import { beforeEach, describe, expect, it } from 'vitest';

import type { SessionState } from '../../../../../domain/value-objects/session/session-state.value-object.js';
import { SessionNotFound } from '../../../../models/session/session-not-found.model.js';
import { UserNotFound } from '../../../../models/session/user-not-found.model.js';
import type { ListUserSessionsOutput } from './list-user-sessions.output.js';
import { ListUserSessions } from './list-user-sessions.use-case.js';
import {
  FakeDeviceReader,
  FixedClock,
  InMemorySessions,
} from '../../../commands/session/sessions.fixture.js';

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

/**
 * Constant IPHONE
 *
 * @description
 * The `User-Agent` of the phone of Camille Martin.
 *
 * @type {string}
 */
const IPHONE: string =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

describe('ListUserSessions', () => {
  let store: InMemorySessions;
  let list: ListUserSessions;

  beforeEach(() => {
    store = new InMemorySessions();
    list = new ListUserSessions(
      store,
      new FakeDeviceReader(),
      new FixedClock('2026-11-09T13:24:00Z'),
    );
    put(store, sessionId(1), CAMILLE_ID, {
      signedInAt: new Date('2026-11-09T07:58:00Z'),
      lastActiveAt: NOW,
    });
    put(
      store,
      sessionId(2),
      CAMILLE_ID,
      {
        signedInAt: new Date('2026-11-09T07:42:00Z'),
        lastActiveAt: new Date('2026-11-09T11:20:00Z'),
      },
      IPHONE,
    );
    put(store, sessionId(3), CAMILLE_ID, {
      signedInAt: new Date('2026-11-09T07:42:00Z'),
      lastActiveAt: new Date('2026-11-09T10:00:00Z'),
    });
    put(store, sessionId(4), CAMILLE_ID, { revokedAt: new Date('2026-11-09T13:00:00Z') });
    put(store, sessionId(5), LEA_ID);
  });

  it('lists the open sessions, the most recent sign-in first then by id, with the current one marked', async () => {
    const page: ListUserSessionsOutput = await list.execute({
      actorUserId: CAMILLE_ID,
      userId: CAMILLE_ID,
      currentSessionId: sessionId(1),
      after: null,
      limit: 50,
    });

    expect(page.next).toBeNull();
    expect(page.items.map((item) => [item.id, item.current])).toEqual([
      [sessionId(1), true],
      [sessionId(3), false],
      [sessionId(2), false],
    ]);
    expect(page.items[2]).toEqual({
      id: sessionId(2),
      current: false,
      device: {
        type: 'mobile',
        browser: 'Safari',
        browserVersion: '18',
        os: 'iOS',
        osVersion: '18.1',
      },
      ipAddress: '192.0.2.14',
      signedInAt: new Date('2026-11-09T07:42:00Z'),
      lastActiveAt: new Date('2026-11-09T11:20:00Z'),
      inactivityTimeoutMinutes: 720,
      expiresAt: new Date('2026-12-09T07:42:00Z'),
    });
  });

  it('pages the list after the position of the previous page', async () => {
    const first: ListUserSessionsOutput = await list.execute({
      actorUserId: CAMILLE_ID,
      userId: CAMILLE_ID,
      currentSessionId: sessionId(1),
      after: null,
      limit: 2,
    });
    expect(first.items.map((item) => item.id)).toEqual([sessionId(1), sessionId(3)]);
    expect(first.next).toEqual({ signedInAt: new Date('2026-11-09T07:42:00Z'), id: sessionId(3) });

    const second: ListUserSessionsOutput = await list.execute({
      actorUserId: CAMILLE_ID,
      userId: CAMILLE_ID,
      currentSessionId: sessionId(1),
      after: first.next,
      limit: 2,
    });
    expect(second.items.map((item) => item.id)).toEqual([sessionId(2)]);
    expect(second.next).toBeNull();
  });

  it('refuses the account of another person', async () => {
    await expect(
      list.execute({
        actorUserId: CAMILLE_ID,
        userId: LEA_ID,
        currentSessionId: sessionId(5),
        after: null,
        limit: 50,
      }),
    ).rejects.toThrow(UserNotFound);
  });

  it('refuses a session of the request that is not an open session of the person', async () => {
    for (const id of [sessionId(4), sessionId(5), sessionId(9)]) {
      await expect(
        list.execute({
          actorUserId: CAMILLE_ID,
          userId: CAMILLE_ID,
          currentSessionId: id,
          after: null,
          limit: 50,
        }),
      ).rejects.toThrow(SessionNotFound);
    }
  });
});
