import { beforeEach, describe, expect, it } from 'vitest';

import type { OpenSessionOutput } from '../open-session/open-session.output.js';
import { OpenSession } from '../open-session/open-session.use-case.js';
import { RevokeSession } from '../revoke-session/revoke-session.use-case.js';
import {
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

describe('IntrospectToken', () => {
  let store: InMemorySessions;
  let clock: FixedClock;
  let introspect: IntrospectToken;
  let opened: OpenSessionOutput;

  beforeEach(async () => {
    store = new InMemorySessions();
    clock = new FixedClock('2026-11-08T13:07:00Z');
    const tokens: FakeSessionTokens = new FakeSessionTokens();
    introspect = new IntrospectToken(store, tokens, clock);
    opened = await new OpenSession(store, tokens, new FakeDeviceReader(), clock).execute({
      userId: CAMILLE_ID,
      persistent: false,
      client: { ipAddress: '86.247.12.30', userAgent: null },
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
      scopes: [],
      expiresAt: new Date('2026-12-08T13:07:00Z'),
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
});
