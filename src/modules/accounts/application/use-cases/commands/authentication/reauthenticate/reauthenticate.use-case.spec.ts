import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import { TwoStepVerification } from '../../../../../domain/aggregates/two-step/two-step-verification.aggregate.js';
import {
  FakeAccountSessions,
  FakeDeviceReader,
  FakePasswordHasher,
  FakeSessionOpener,
  FixedClock,
  InMemoryAccounts,
} from '../../../../models/accounts/accounts.fixture.js';
import {
  FakeAuthenticatorAppSecrets,
  FakeChallengeTokens,
  FakeTotp,
  FakeTrustedDevices,
} from '../../../../models/two-step/two-step.fixture.js';
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
    reauthenticate = new Reauthenticate(
      accounts,
      hasher,
      sessions,
      new FakeAuthenticatorAppSecrets(),
      new FakeTotp(),
      clock,
    );
    camille = accounts.seedUser('camille.martin@ateliernord.fr', true, `hashed:${PASSWORD}`);
    sessions.seed(SESSION_ID, camille.id, null);
  });

  it('records a recent authentication of the session for 10 minutes', async () => {
    const recent: RecentAuthentication = await reauthenticate.execute({
      actorUserId: camille.id,
      sessionId: SESSION_ID,
      password: PASSWORD,
      code: null,
    });

    expect(recent).toEqual({
      authenticatedAt: new Date('2026-11-09T13:12:00Z'),
      expiresAt: new Date('2026-11-09T13:22:00Z'),
    });
    await expect(sessions.check(camille.id, SESSION_ID)).resolves.toBe('recent');
  });

  it('refuses a password changed during its check, without a recent authentication', async () => {
    const verify: FakePasswordHasher['verify'] = hasher.verify.bind(hasher);
    vi.spyOn(hasher, 'verify').mockImplementation(
      async (password: string, passwordHash: string | null): Promise<boolean> => {
        const matches: boolean = await verify(password, passwordHash);
        accounts.state.credentials.set(camille.id, 'hashed:nord-atelier-sprint-15');
        return matches;
      },
    );

    await expect(
      reauthenticate.execute({
        actorUserId: camille.id,
        sessionId: SESSION_ID,
        password: PASSWORD,
        code: null,
      }),
    ).rejects.toMatchObject({ refusal: { reason: 'password-incorrect', remainingAttempts: 4 } });
    await expect(sessions.check(camille.id, SESSION_ID)).resolves.toBe('stale');
    expect(accounts.state.lockouts.get(camille.email.value)?.snapshot.failedAttempts).toBe(1);
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
        reauthenticate.execute({
          actorUserId: camille.id,
          sessionId,
          password: PASSWORD,
          code: null,
        }),
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
        code: null,
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
      new FakeTrustedDevices(),
      new FakeChallengeTokens(),
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
      reauthenticate.execute({
        actorUserId: camille.id,
        sessionId: SESSION_ID,
        password: 'wrong',
        code: null,
      }),
    ).rejects.toMatchObject({ refusal: { reason: 'password-incorrect', remainingAttempts: 1 } });
    await expect(
      reauthenticate.execute({
        actorUserId: camille.id,
        sessionId: SESSION_ID,
        password: 'wrong',
        code: null,
      }),
    ).rejects.toMatchObject({
      refusal: { reason: 'account-locked', lockedUntil: new Date('2026-11-09T13:27:00Z') },
    });
    await expect(
      reauthenticate.execute({
        actorUserId: camille.id,
        sessionId: SESSION_ID,
        password: PASSWORD,
        code: null,
      }),
    ).rejects.toMatchObject({ refusal: { reason: 'account-locked' } });
    await expect(sessions.countOpen(camille.id)).resolves.toBe(1);
  });

  it('ends the count of the failed passwords with the right one', async () => {
    await expect(
      reauthenticate.execute({
        actorUserId: camille.id,
        sessionId: SESSION_ID,
        password: 'wrong',
        code: null,
      }),
    ).rejects.toBeDefined();

    await reauthenticate.execute({
      actorUserId: camille.id,
      sessionId: SESSION_ID,
      password: PASSWORD,
      code: null,
    });

    expect(accounts.state.lockouts.has(camille.email.value)).toBe(false);
  });
  describe('with two-step verification', () => {
    const SECRET: string = 'JBSWY3DPEHPK3PXP';

    beforeEach(() => {
      accounts.state.twoStep.set(
        camille.id,
        TwoStepVerification.enable(
          camille.id,
          `sealed:${camille.id}:${SECRET}`,
          FakeTotp.stepAt(new Date('2026-11-09T13:00:00Z')),
          'handle-1',
          new Date('2026-11-09T13:00:00Z'),
        ),
      );
      sessions.enrolled.add(camille.id);
    });

    it('refuses the password, neither checked nor counted, and asks for the app', async () => {
      await expect(
        reauthenticate.execute({
          actorUserId: camille.id,
          sessionId: SESSION_ID,
          password: PASSWORD,
          code: null,
        }),
      ).rejects.toMatchObject({
        refusal: { reason: 'reauthentication-required', methods: ['authenticator-app'] },
      });
      expect(accounts.state.lockouts.size).toBe(0);
      await expect(sessions.check(camille.id, SESSION_ID)).resolves.toBe('stale');
    });

    it('records a recent authentication by a second factor for a right code, accepted once', async () => {
      const code: string = FakeTotp.codeOf(SECRET, FakeTotp.stepAt(clock.now()));

      await expect(
        reauthenticate.execute({
          actorUserId: camille.id,
          sessionId: SESSION_ID,
          password: null,
          code,
        }),
      ).resolves.toEqual({
        authenticatedAt: new Date('2026-11-09T13:12:00Z'),
        expiresAt: new Date('2026-11-09T13:22:00Z'),
      });
      expect(sessions.sessions.get(SESSION_ID)?.method).toBe('two-step');
      await expect(sessions.check(camille.id, SESSION_ID)).resolves.toBe('recent');
      await expect(
        reauthenticate.execute({
          actorUserId: camille.id,
          sessionId: SESSION_ID,
          password: null,
          code,
        }),
      ).rejects.toMatchObject({
        refusal: { reason: 'two-step-code-invalid', remainingAttempts: 4 },
      });
    });

    it('locks the second factor for 15 minutes after 5 wrong codes, the right one included', async () => {
      for (let attempt: number = 1; attempt < 5; attempt += 1) {
        await expect(
          reauthenticate.execute({
            actorUserId: camille.id,
            sessionId: SESSION_ID,
            password: null,
            code: '000000',
          }),
        ).rejects.toMatchObject({
          refusal: { reason: 'two-step-code-invalid', remainingAttempts: 5 - attempt },
        });
      }
      await expect(
        reauthenticate.execute({
          actorUserId: camille.id,
          sessionId: SESSION_ID,
          password: null,
          code: '000000',
        }),
      ).rejects.toMatchObject({
        refusal: { reason: 'two-step-locked', lockedUntil: new Date('2026-11-09T13:27:00Z') },
      });
      await expect(
        reauthenticate.execute({
          actorUserId: camille.id,
          sessionId: SESSION_ID,
          password: null,
          code: FakeTotp.codeOf(SECRET, FakeTotp.stepAt(clock.now())),
        }),
      ).rejects.toMatchObject({ refusal: { reason: 'two-step-locked' } });
      await expect(sessions.check(camille.id, SESSION_ID)).resolves.toBe('stale');
    });
  });

  it('refuses a code for an account without two-step verification', async () => {
    await expect(
      reauthenticate.execute({
        actorUserId: camille.id,
        sessionId: SESSION_ID,
        password: null,
        code: '261845',
      }),
    ).rejects.toMatchObject({ refusal: { reason: 'two-step-not-enabled' } });
  });
});
