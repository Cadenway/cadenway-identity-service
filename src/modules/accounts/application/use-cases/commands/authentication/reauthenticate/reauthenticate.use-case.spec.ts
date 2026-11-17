import { beforeEach, describe, expect, it } from 'vitest';

import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import {
  FakeAccountSessions,
  FakeDeviceReader,
  FakePasswordHasher,
  FakeSessionOpener,
  FixedClock,
  InMemoryAccounts,
} from '../../../../models/accounts/accounts.fixture.js';
import type { RecentAuthentication } from '../../../../models/sessions/recent-authentication.model.js';
import { SignInWithPassword } from '../sign-in-with-password/sign-in-with-password.use-case.js';
import { Reauthenticate } from './reauthenticate.use-case.js';

/**
 * Constant PASSWORD
 *
 * @description
 * The password of Camille Martin.
 *
 * @type {string}
 */
const PASSWORD: string = 'atelier-nord-sprint-14';

/**
 * Constant SESSION_ID
 *
 * @description
 * The session of the request.
 *
 * @type {string}
 */
const SESSION_ID: string = '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60';

describe('Reauthenticate', () => {
  let accounts: InMemoryAccounts;
  let clock: FixedClock;
  let hasher: FakePasswordHasher;
  let sessions: FakeAccountSessions;
  let reauthenticate: Reauthenticate;
  let camille: User;

  beforeEach(() => {
    accounts = new InMemoryAccounts();
    clock = new FixedClock('2026-11-09T13:12:00Z');
    hasher = new FakePasswordHasher();
    sessions = new FakeAccountSessions(clock);
    reauthenticate = new Reauthenticate(accounts, hasher, sessions, clock);
    camille = accounts.seedUser('camille.martin@ateliernord.fr', true, `hashed:${PASSWORD}`);
    sessions.seed(SESSION_ID, camille.id, null);
  });

  it('records a recent authentication of the session for 10 minutes', async () => {
    const recent: RecentAuthentication = await reauthenticate.execute({
      actorUserId: camille.id,
      sessionId: SESSION_ID,
      password: PASSWORD,
    });

    expect(recent).toEqual({
      authenticatedAt: new Date('2026-11-09T13:12:00Z'),
      expiresAt: new Date('2026-11-09T13:22:00Z'),
    });
    await expect(sessions.check(camille.id, SESSION_ID)).resolves.toBe('recent');
  });

  it('refuses a session of another person, or one that ended, without counting an attempt', async () => {
    sessions.seed(
      '019a6a2e-4b1c-7d3e-8f5a-000000000099',
      '019a5f3c-8d2e-7c4a-9b1f-ffffffffffff',
      null,
    );
    for (const sessionId of [
      '019a6a2e-4b1c-7d3e-8f5a-000000000099',
      '019a6a2e-4b1c-7d3e-8f5a-000000000098',
    ]) {
      await expect(
        reauthenticate.execute({ actorUserId: camille.id, sessionId, password: PASSWORD }),
      ).rejects.toMatchObject({ refusal: { reason: 'session-not-found' } });
    }
    expect(accounts.state.lockouts.size).toBe(0);
  });

  it('answers a wrong password with the attempts left, and keeps the session open', async () => {
    await expect(
      reauthenticate.execute({
        actorUserId: camille.id,
        sessionId: SESSION_ID,
        password: 'not-the-password',
      }),
    ).rejects.toMatchObject({ refusal: { reason: 'password-incorrect', remainingAttempts: 4 } });

    await expect(sessions.check(camille.id, SESSION_ID)).resolves.toBe('stale');
    expect(accounts.state.lockouts.get(camille.email.value)?.snapshot.failedAttempts).toBe(1);
  });

  it('shares the lockout with the password sign-in of the address', async () => {
    const signIn: SignInWithPassword = new SignInWithPassword(
      accounts,
      hasher,
      new FakeSessionOpener(accounts),
      clock,
      new FakeDeviceReader(),
    );
    for (let attempt: number = 0; attempt < 3; attempt += 1) {
      await expect(
        signIn.execute({
          email: camille.email.value,
          password: 'not-the-password',
          rememberMe: false,
          client: { ipAddress: '86.247.12.30', userAgent: null },
        }),
      ).rejects.toMatchObject({ refusal: { reason: 'invalid-credentials' } });
    }
    await expect(
      reauthenticate.execute({ actorUserId: camille.id, sessionId: SESSION_ID, password: 'wrong' }),
    ).rejects.toMatchObject({ refusal: { reason: 'password-incorrect', remainingAttempts: 1 } });
    await expect(
      reauthenticate.execute({ actorUserId: camille.id, sessionId: SESSION_ID, password: 'wrong' }),
    ).rejects.toMatchObject({
      refusal: { reason: 'account-locked', lockedUntil: new Date('2026-11-09T13:27:00Z') },
    });
    await expect(
      reauthenticate.execute({
        actorUserId: camille.id,
        sessionId: SESSION_ID,
        password: PASSWORD,
      }),
    ).rejects.toMatchObject({ refusal: { reason: 'account-locked' } });
    await expect(sessions.countOpen(camille.id)).resolves.toBe(1);
  });

  it('ends the count of the failed passwords with the right one', async () => {
    await expect(
      reauthenticate.execute({ actorUserId: camille.id, sessionId: SESSION_ID, password: 'wrong' }),
    ).rejects.toBeDefined();

    await reauthenticate.execute({
      actorUserId: camille.id,
      sessionId: SESSION_ID,
      password: PASSWORD,
    });

    expect(accounts.state.lockouts.has(camille.email.value)).toBe(false);
  });
});
