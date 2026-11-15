import { describe, expect, it } from 'vitest';

import {
  FakeDeviceReader,
  FakeSessionTokens,
  FixedClock,
  InMemorySessions,
} from '../sessions.fixture.js';
import type { StoredSession } from '../sessions.fixture.js';
import { OpenSession } from './open-session.js';
import type { OpenSessionOutput } from './open-session.js';

describe('OpenSession', () => {
  it('stores the hash of the token with the browser, and returns the token once', async () => {
    const store: InMemorySessions = new InMemorySessions();
    const open: OpenSession = new OpenSession(
      store,
      new FakeSessionTokens(),
      new FakeDeviceReader(),
      new FixedClock('2026-11-08T13:07:00Z'),
    );

    const opened: OpenSessionOutput = await open.execute({
      userId: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
      persistent: true,
      client: { ipAddress: '86.247.12.30', userAgent: 'Mozilla/5.0 Firefox/145.0' },
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
    expect(JSON.stringify(stored?.state)).not.toContain(opened.token);
  });
});
