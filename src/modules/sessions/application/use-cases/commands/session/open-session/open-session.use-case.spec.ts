import { beforeEach, describe, expect, it } from 'vitest';

import {
  FakeActiveMemberships,
  FakeDeviceReader,
  FakeSessionTokens,
  FixedClock,
  InMemorySessions,
} from '../sessions.fixture.js';
import type { StoredSession } from '../sessions.fixture.js';
import type { OpenSessionOutput } from './open-session.output.js';
import { OpenSession } from './open-session.use-case.js';

const CAMILLE_ID = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';
const ATELIER_NORD = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';
const MEMBER_ID = '019a6b10-0000-7000-8000-000000000001';
const CLIENT = { ipAddress: '86.247.12.30', userAgent: 'Mozilla/5.0 Firefox/145.0' } as const;

describe('OpenSession', () => {
  let store: InMemorySessions;
  let memberships: FakeActiveMemberships;
  let open: OpenSession;

  beforeEach(() => {
    store = new InMemorySessions();
    memberships = new FakeActiveMemberships();
    open = new OpenSession(
      store,
      new FakeSessionTokens(),
      new FakeDeviceReader(),
      memberships,
      new FixedClock('2026-11-08T13:07:00Z'),
    );
  });

  it('stores the hash of the token with the browser, and returns the token once', async () => {
    const opened: OpenSessionOutput = await open.execute({
      userId: CAMILLE_ID,
      persistent: true,
      client: CLIENT,
      newDeviceNotice: null,
    });

    expect(opened).toEqual({
      token: expect.stringMatching(/^T+1$/u) as unknown,
      id: '019a6a2e-4b1c-7d3e-8f5a-000000000001',
      expiresAt: new Date('2026-12-08T13:07:00Z'),
      persistent: true,
    });
    const stored: StoredSession | undefined = store.sessions.get(opened.id);
    expect(stored?.origin).toEqual({
      tokenHash: `hash:${opened.token}`,
      ipAddress: '86.247.12.30',
      userAgent: 'Mozilla/5.0 Firefox/145.0',
      device: {
        type: 'desktop',
        browser: 'Firefox',
        browserVersion: '145',
        os: 'Windows',
        osVersion: null,
      },
    });
    expect(stored?.state).toMatchObject({ organizationId: null, memberId: null });
    expect(JSON.stringify(stored?.state)).not.toContain(opened.token);
  });

  it('starts in the organization the account last chose while it is still a member there', async () => {
    store.choices.set(CAMILLE_ID, ATELIER_NORD);
    memberships.join(CAMILLE_ID, {
      memberId: MEMBER_ID,
      organizationId: ATELIER_NORD,
      role: 'owner',
    });

    const opened: OpenSessionOutput = await open.execute({
      userId: CAMILLE_ID,
      persistent: false,
      client: CLIENT,
      newDeviceNotice: null,
    });

    expect(store.sessions.get(opened.id)?.state).toMatchObject({
      organizationId: ATELIER_NORD,
      memberId: MEMBER_ID,
      version: 1,
    });
  });

  it('starts in no organization once the account left the one it last chose', async () => {
    store.choices.set(CAMILLE_ID, ATELIER_NORD);

    const opened: OpenSessionOutput = await open.execute({
      userId: CAMILLE_ID,
      persistent: false,
      client: CLIENT,
      newDeviceNotice: null,
    });

    expect(store.sessions.get(opened.id)?.state).toMatchObject({
      organizationId: null,
      memberId: null,
    });
  });
});

/**
 * Constant NOTICE
 *
 * @description
 * Whom "Nouvelle connexion" addresses for Camille Martin.
 *
 * @type {{ readonly email: string; readonly name: string; readonly language: string; readonly timeZone: string }}
 */
const NOTICE: {
  readonly email: string;
  readonly name: string;
  readonly language: string;
  readonly timeZone: string;
} = {
  email: 'camille.martin@ateliernord.fr',
  name: 'Camille Martin',
  language: 'fr',
  timeZone: 'Europe/Paris',
};

/**
 * Constant OPENED_AT
 *
 * @description
 * The sign-in of the specs, the instant of their clock.
 *
 * @type {Date}
 */
const OPENED_AT: Date = new Date('2026-11-08T13:07:00Z');

/**
 * Constant DAY
 *
 * @description
 * One day, in milliseconds.
 *
 * @type {number}
 */
const DAY: number = 24 * 60 * 60_000;

/**
 * Function earlier
 *
 * @description
 * Stores an earlier session of Camille Martin, last active some days before the sign-in.
 *
 * @param {InMemorySessions} store - The fake sessions.
 * @param {string | null} userAgent - Its `User-Agent`.
 * @param {number} days - Days between its last activity and the sign-in.
 * @param {string} id - Its id, one per earlier session.
 */
function earlier(
  store: InMemorySessions,
  userAgent: string | null,
  days: number,
  id: string = '019a6a2e-4b1c-7d3e-8f5a-ffffffffffff',
): void {
  const lastActiveAt: Date = new Date(OPENED_AT.getTime() - days * DAY);
  store.sessions.set(id, {
    state: {
      id,
      userId: CAMILLE_ID,
      persistent: false,
      lastActiveAt,
      expiresAt: new Date(lastActiveAt.getTime() + 30 * DAY),
      revokedAt: lastActiveAt,
      organizationId: null,
      memberId: null,
      version: 2,
      signedInAt: lastActiveAt,
      authenticatedAt: null,
    },
    origin: {
      tokenHash: 'hash:earlier',
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

describe('OpenSession on a new device', () => {
  let store: InMemorySessions;
  let open: OpenSession;

  beforeEach(() => {
    store = new InMemorySessions();
    open = new OpenSession(
      store,
      new FakeSessionTokens(),
      new FakeDeviceReader(),
      new FakeActiveMemberships(),
      new FixedClock('2026-11-08T13:07:00Z'),
    );
  });

  it('starts recently authenticated by the sign-in', async () => {
    const opened: OpenSessionOutput = await open.execute({
      userId: CAMILLE_ID,
      persistent: false,
      client: CLIENT,
      newDeviceNotice: NOTICE,
    });

    expect(store.sessions.get(opened.id)?.state).toMatchObject({
      signedInAt: OPENED_AT,
      authenticatedAt: OPENED_AT,
    });
  });

  it('tells nobody for the session of the sign-up verification', async () => {
    await open.execute({
      userId: CAMILLE_ID,
      persistent: false,
      client: CLIENT,
      newDeviceNotice: null,
    });

    expect(store.newDevices).toEqual([]);
  });

  it('tells the person of a device no session of the account used', async () => {
    const opened: OpenSessionOutput = await open.execute({
      userId: CAMILLE_ID,
      persistent: false,
      client: CLIENT,
      newDeviceNotice: NOTICE,
    });

    expect(store.newDevices).toEqual([
      {
        session: expect.objectContaining({ id: opened.id }) as unknown,
        email: 'camille.martin@ateliernord.fr',
        device: {
          type: 'desktop',
          browser: 'Firefox',
          browserVersion: '145',
          os: 'Windows',
          osVersion: null,
        },
      },
    ]);
  });

  it('tells nobody for a device a session of the account used in the last 90 days, whatever its version', async () => {
    earlier(store, 'Mozilla/5.0 Firefox/132.0', 89);

    await open.execute({
      userId: CAMILLE_ID,
      persistent: false,
      client: CLIENT,
      newDeviceNotice: NOTICE,
    });

    expect(store.newDevices).toEqual([]);
  });

  it('tells the person of a device last used more than 90 days ago', async () => {
    earlier(store, 'Mozilla/5.0 Firefox/132.0', 91);

    await open.execute({
      userId: CAMILLE_ID,
      persistent: false,
      client: CLIENT,
      newDeviceNotice: NOTICE,
    });

    expect(store.newDevices).toHaveLength(1);
  });

  it('compares with the 100 browsers the account used last only', async () => {
    earlier(store, 'Mozilla/5.0 Firefox/132.0', 2);
    for (let index: number = 0; index < 100; index += 1) {
      earlier(
        store,
        `Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) Mobile/${String(index)}`,
        1,
        `019a6a2e-4b1c-7d3e-8f5a-${String(index).padStart(12, '0')}`,
      );
    }

    await open.execute({
      userId: CAMILLE_ID,
      persistent: false,
      client: CLIENT,
      newDeviceNotice: NOTICE,
    });

    expect(store.newDevices).toHaveLength(1);
  });

  it('tells the person of another device than the known ones', async () => {
    earlier(store, 'Mozilla/5.0 Firefox/132.0', 1);

    await open.execute({
      userId: CAMILLE_ID,
      persistent: false,
      client: {
        ipAddress: '86.247.12.30',
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) Version/18.1 Safari/604.1',
      },
      newDeviceNotice: NOTICE,
    });

    expect(store.newDevices.map(({ device }) => device.os)).toEqual(['iOS']);
  });
});
