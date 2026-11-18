import { beforeEach, describe, expect, it } from 'vitest';

import { SessionNotFound } from '../../../../models/session/session-not-found.model.js';
import type { OpenSessionOutput } from '../open-session/open-session.output.js';
import { OpenSession } from '../open-session/open-session.use-case.js';
import {
  FakeActiveMemberships,
  FakeDeviceReader,
  FakeSessionTokens,
  FixedClock,
  InMemorySessions,
} from '../sessions.fixture.js';
import { RevokeSession } from './revoke-session.use-case.js';

/**
 * Constant CAMILLE_ID
 *
 * @description
 * Id of the account of Camille Martin.
 *
 * @type {string}
 */
const CAMILLE_ID: string = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';

describe('RevokeSession', () => {
  let store: InMemorySessions;
  let clock: FixedClock;
  let revoke: RevokeSession;
  let opened: OpenSessionOutput;

  beforeEach(async () => {
    store = new InMemorySessions();
    clock = new FixedClock('2026-11-08T13:07:00Z');
    revoke = new RevokeSession(store, clock);
    opened = await new OpenSession(
      store,
      new FakeSessionTokens(),
      new FakeDeviceReader(),
      new FakeActiveMemberships(),
      clock,
    ).execute({
      userId: CAMILLE_ID,
      persistent: true,
      client: { ipAddress: '86.247.12.30', userAgent: null },
      newDeviceNotice: null,
    });
  });

  it('revokes the session of the actor at version 2 and emits its revocation', async () => {
    clock.advance(60_000);

    await revoke.execute({ actorUserId: CAMILLE_ID, sessionId: opened.id });

    expect(store.sessions.get(opened.id)?.state).toMatchObject({
      revokedAt: new Date('2026-11-08T13:08:00Z'),
      version: 2,
    });
    expect(store.revoked).toHaveLength(1);
    expect(store.revoked[0]?.actorUserId).toBe(CAMILLE_ID);
    expect(store.revoked[0]?.session.snapshot.version).toBe(2);
  });

  it('changes nothing and emits nothing for a session already ended', async () => {
    await revoke.execute({ actorUserId: CAMILLE_ID, sessionId: opened.id });
    await revoke.execute({ actorUserId: CAMILLE_ID, sessionId: opened.id });

    expect(store.revoked).toHaveLength(1);
  });

  it('refuses a session of another user like an unknown one', async () => {
    await expect(
      revoke.execute({ actorUserId: '019a5f3c-8d2e-7c4a-9b1f-ffffffffffff', sessionId: opened.id }),
    ).rejects.toBeInstanceOf(SessionNotFound);
    await expect(
      revoke.execute({
        actorUserId: CAMILLE_ID,
        sessionId: '019a6a2e-4b1c-7d3e-8f5a-ffffffffffff',
      }),
    ).rejects.toBeInstanceOf(SessionNotFound);
    expect(store.sessions.get(opened.id)?.state.revokedAt).toBeNull();
  });
});
