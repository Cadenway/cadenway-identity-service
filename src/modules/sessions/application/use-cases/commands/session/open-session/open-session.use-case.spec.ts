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
      device: { browser: 'Firefox 145', operatingSystem: 'Windows 10', deviceType: 'desktop' },
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
    });

    expect(store.sessions.get(opened.id)?.state).toMatchObject({
      organizationId: null,
      memberId: null,
    });
  });
});
