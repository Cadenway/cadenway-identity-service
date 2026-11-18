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
  BACKUP_CODES,
  challenged,
  FakeBackupCodeSecrets,
  FakeChallengeTokens,
  FakeTrustedDevices,
  FIREFOX,
  seedTwoStep,
} from '../../../../models/two-step/two-step.fixture.js';
import type { SignInChallengeView } from '../../../../projections/two-step/sign-in-challenge-view.projection.js';
import { SignInWithPassword } from '../sign-in-with-password/sign-in-with-password.use-case.js';
import { AnswerChallengeWithBackupCode } from './answer-challenge-with-backup-code.use-case.js';

describe('AnswerChallengeWithBackupCode', () => {
  let accounts: InMemoryAccounts;
  let sessions: FakeSessionOpener;
  let signIn: SignInWithPassword;
  let answer: AnswerChallengeWithBackupCode;
  let camille: User;

  /**
   * Function challenge
   *
   * @description
   * Signs Camille Martin in with her password, which answers a two-step challenge.
   *
   * @returns {Promise<SignInChallengeView>} The challenge.
   */
  async function challenge(): Promise<SignInChallengeView> {
    return challenged(
      await signIn.execute({
        email: camille.email.value,
        password: 'atelier-nord-sprint-14',
        rememberMe: false,
        client: FIREFOX,
      }),
    );
  }

  beforeEach(() => {
    accounts = new InMemoryAccounts();
    const clock: FixedClock = new FixedClock('2026-11-09T07:37:00Z');
    sessions = new FakeSessionOpener(accounts);
    const trustedDevices: FakeTrustedDevices = new FakeTrustedDevices();
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
    answer = new AnswerChallengeWithBackupCode(
      accounts,
      tokens,
      new FakeBackupCodeSecrets(),
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
  });

  it('opens the session for a backup code, without its dash and in any case, and uses it up', async () => {
    const first: SignInChallengeView = await challenge();
    expect(first.backupCodesRemaining).toBe(3);
    expect(first.methods).toEqual(['authenticator-app', 'backup-code']);

    await answer.execute({
      token: first.token,
      code: 'r8tx6wbn',
      trustDevice: false,
      client: FIREFOX,
    });

    expect(sessions.opened).toHaveLength(1);
    expect((await challenge()).backupCodesRemaining).toBe(2);
  });

  it('accepts a backup code once', async () => {
    await answer.execute({
      token: (await challenge()).token,
      code: BACKUP_CODES[0] ?? '',
      trustDevice: false,
      client: FIREFOX,
    });

    await expect(
      answer.execute({
        token: (await challenge()).token,
        code: BACKUP_CODES[0] ?? '',
        trustDevice: false,
        client: FIREFOX,
      }),
    ).rejects.toMatchObject({ refusal: { reason: 'two-step-code-invalid', remainingAttempts: 4 } });
    expect(sessions.opened).toHaveLength(1);
  });

  it('counts a wrong or malformed backup code with the other wrong answers', async () => {
    const { token } = await challenge();

    await expect(
      answer.execute({ token, code: 'ZZZZ-ZZZZ', trustDevice: false, client: FIREFOX }),
    ).rejects.toMatchObject({ refusal: { reason: 'two-step-code-invalid', remainingAttempts: 4 } });
    await expect(
      answer.execute({ token, code: 'ZZZ', trustDevice: false, client: FIREFOX }),
    ).rejects.toMatchObject({ refusal: { reason: 'two-step-code-invalid', remainingAttempts: 3 } });
  });
});
