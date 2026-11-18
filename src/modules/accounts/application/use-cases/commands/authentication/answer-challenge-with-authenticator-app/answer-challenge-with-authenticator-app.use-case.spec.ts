import { beforeEach, describe, expect, it } from 'vitest';

import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import {
  FakeDeviceReader,
  FakePasswordHasher,
  FakeSessionOpener,
  FixedClock,
  InMemoryAccounts,
} from '../../../../models/accounts/accounts.fixture.js';
import {
  APP_SECRET,
  challenged,
  FakeAuthenticatorAppSecrets,
  FakeChallengeTokens,
  FakeTotp,
  FakeTrustedDevices,
  FIREFOX,
  seedTwoStep,
} from '../../../../models/two-step/two-step.fixture.js';
import type { SessionIssuedView } from '../../../../projections/authentication/session-issued-view.projection.js';
import type { SignInChallengeView } from '../../../../projections/two-step/sign-in-challenge-view.projection.js';
import { SignInWithPassword } from '../sign-in-with-password/sign-in-with-password.use-case.js';
import { AnswerChallengeWithAuthenticatorApp } from './answer-challenge-with-authenticator-app.use-case.js';

describe('AnswerChallengeWithAuthenticatorApp', () => {
  let accounts: InMemoryAccounts;
  let clock: FixedClock;
  let sessions: FakeSessionOpener;
  let trustedDevices: FakeTrustedDevices;
  let signIn: SignInWithPassword;
  let answer: AnswerChallengeWithAuthenticatorApp;
  let camille: User;

  /**
   * Function challenge
   *
   * @description
   * Signs Camille Martin in with her password, which answers a two-step challenge.
   *
   * @param {boolean} rememberMe - Whether the session outlives the browser.
   * @returns {Promise<SignInChallengeView>} The challenge.
   */
  async function challenge(rememberMe: boolean = false): Promise<SignInChallengeView> {
    return challenged(
      await signIn.execute({
        email: camille.email.value,
        password: 'atelier-nord-sprint-14',
        rememberMe,
        client: FIREFOX,
      }),
    );
  }

  /**
   * Function codeNow
   *
   * @description
   * The code the app of Camille Martin shows at the instant of the spec.
   *
   * @returns {string} The 6 digits.
   */
  function codeNow(): string {
    return FakeTotp.codeOf(APP_SECRET, FakeTotp.stepAt(clock.now()));
  }

  beforeEach(() => {
    accounts = new InMemoryAccounts();
    clock = new FixedClock('2026-11-09T07:37:00Z');
    sessions = new FakeSessionOpener(accounts);
    trustedDevices = new FakeTrustedDevices();
    const tokens: FakeChallengeTokens = new FakeChallengeTokens();
    signIn = new SignInWithPassword(
      accounts,
      new FakePasswordHasher(),
      sessions,
      clock,
      new FakeDeviceReader(),
      trustedDevices,
      tokens,
    );
    answer = new AnswerChallengeWithAuthenticatorApp(
      accounts,
      tokens,
      new FakeAuthenticatorAppSecrets(),
      new FakeTotp(),
      sessions,
      new FakeDeviceReader(),
      trustedDevices,
      clock,
    );
    camille = accounts.seedUser(
      'camille.martin@ateliernord.fr',
      true,
      'hashed:atelier-nord-sprint-14',
    );
    seedTwoStep(accounts, camille.id, new Date('2026-03-03T10:15:00Z'));
    clock.advance(30_000);
  });

  it('opens the session of the challenge for the right code, by a second factor, once', async () => {
    const { token } = await challenge(true);

    const issued: SessionIssuedView = await answer.execute({
      token,
      code: codeNow(),
      trustDevice: false,
      client: FIREFOX,
    });

    expect(issued.user.id).toBe(camille.id);
    expect(issued.trustedDevice).toBeNull();
    expect(sessions.opened).toMatchObject([
      {
        request: { userId: camille.id, persistent: true, authentication: 'two-step' },
        inTransaction: true,
      },
    ]);
    expect(accounts.state.challenges.has(camille.id)).toBe(false);
    await expect(
      answer.execute({ token, code: codeNow(), trustDevice: false, client: FIREFOX }),
    ).rejects.toMatchObject({ refusal: { reason: 'challenge-expired' } });
  });

  it('refuses the code of a step already accepted, even with a new challenge', async () => {
    const code: string = codeNow();
    await answer.execute({
      token: (await challenge()).token,
      code,
      trustDevice: false,
      client: FIREFOX,
    });

    await expect(
      answer.execute({
        token: (await challenge()).token,
        code,
        trustDevice: false,
        client: FIREFOX,
      }),
    ).rejects.toMatchObject({ refusal: { reason: 'two-step-code-invalid', remainingAttempts: 4 } });
  });

  it('trusts the browser for 30 days when asked', async () => {
    const issued: SessionIssuedView = await answer.execute({
      token: (await challenge()).token,
      code: codeNow(),
      trustDevice: true,
      client: FIREFOX,
    });

    expect(issued.trustedDevice).toEqual({
      token: 'device-1',
      expiresAt: new Date('2026-12-09T13:12:00Z'),
    });
    await expect(trustedDevices.isTrusted(camille.id, 'device-1')).resolves.toBe(true);
  });

  it('commits every wrong code, locks for 15 minutes at the fifth and refuses the right one then', async () => {
    const { token } = await challenge();
    for (let attempt: number = 1; attempt < 5; attempt += 1) {
      await expect(
        answer.execute({ token, code: '000000', trustDevice: false, client: FIREFOX }),
      ).rejects.toMatchObject({
        refusal: { reason: 'two-step-code-invalid', remainingAttempts: 5 - attempt },
      });
    }
    await expect(
      answer.execute({ token, code: '000000', trustDevice: false, client: FIREFOX }),
    ).rejects.toMatchObject({
      refusal: { reason: 'two-step-locked', lockedUntil: new Date('2026-11-09T07:52:30Z') },
    });

    await expect(
      answer.execute({ token, code: codeNow(), trustDevice: false, client: FIREFOX }),
    ).rejects.toMatchObject({ refusal: { reason: 'two-step-locked' } });
    expect(sessions.opened).toEqual([]);
    expect((await challenge()).lockedUntil).toEqual(new Date('2026-11-09T07:52:30Z'));
  });

  it('refuses an expired, a replaced or an unknown challenge without counting', async () => {
    const first: SignInChallengeView = await challenge();
    await challenge();

    await expect(
      answer.execute({ token: first.token, code: '000000', trustDevice: false, client: FIREFOX }),
    ).rejects.toMatchObject({ refusal: { reason: 'challenge-expired' } });
    await expect(
      answer.execute({ token: 'not-a-token', code: '000000', trustDevice: false, client: FIREFOX }),
    ).rejects.toMatchObject({ refusal: { reason: 'challenge-expired' } });
    const latest: SignInChallengeView = await challenge();
    clock.advance(10 * 60_000);
    await expect(
      answer.execute({ token: latest.token, code: codeNow(), trustDevice: false, client: FIREFOX }),
    ).rejects.toMatchObject({ refusal: { reason: 'challenge-expired' } });
    expect(accounts.state.twoStep.get(camille.id)?.snapshot.failedAnswers).toBe(0);
  });
});
