import { beforeEach, describe, expect, it } from 'vitest';

import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import type { OneTimeCodeState } from '../../../../../domain/aggregates/one-time-codes/one-time-code-state.aggregate.js';
import {
  FakeCodeSecrets,
  FakeCompromisedPasswords,
  FakePasswordHasher,
  FakeSessionOpener,
  FixedClock,
  InMemoryAccounts,
} from '../../../../models/accounts/accounts.fixture.js';
import type { RecordedEvent } from '../../../../models/accounts/accounts.fixture.js';
import type { SessionIssuedView } from '../../../../projections/authentication/session-issued-view.projection.js';
import { ResendSignUpCode } from '../resend-sign-up-code/resend-sign-up-code.use-case.js';
import type { SignUpInput } from '../sign-up/sign-up.input.js';
import { SignUp } from '../sign-up/sign-up.use-case.js';
import type { VerifySignUpInput } from './verify-sign-up.input.js';
import { VerifySignUp } from './verify-sign-up.use-case.js';

/**
 * Constant VERIFICATION
 *
 * @description
 * The code of the contract's example, typed on the Otp screen, without a password.
 *
 * @type {VerifySignUpInput}
 */
const VERIFICATION: VerifySignUpInput = {
  email: 'camille.martin@ateliernord.fr',
  code: '482913',
  rememberMe: false,
  client: { ipAddress: '86.247.12.30', userAgent: 'Mozilla/5.0 Firefox/145.0' },
};

/**
 * Constant SIGN_UP
 *
 * @description
 * The sign-up of Camille Martin on the Inscription screen, as the contract's example.
 *
 * @type {SignUpInput}
 */
const SIGN_UP: SignUpInput = {
  name: 'Camille Martin',
  email: 'camille.martin@ateliernord.fr',
  password: 'atelier-nord-sprint-14',
  acceptTerms: true,
};

/**
 * Constant OTHER_PASSWORD
 *
 * @description
 * The password of a later sign-up of the same address by someone else.
 *
 * @type {string}
 */
const OTHER_PASSWORD: string = 'not-camille-sprint-15';

/**
 * Class WatchedPasswordHasher
 *
 * @description
 * The fake hasher, recording whether each check runs inside a unit of work, and running a hook
 * before it answers, so a spec can change the account between the two transactions.
 */
class WatchedPasswordHasher extends FakePasswordHasher {
  // #region Properties
  /**
   * Property checks
   *
   * @description
   * For each check, whether a unit of work was running.
   *
   * @type {boolean[]}
   * @readonly
   */
  public readonly checks: boolean[] = [];

  /**
   * Property beforeAnswer
   *
   * @description
   * Run during a check, before it answers.
   *
   * @type {() => Promise<void>}
   */
  public beforeAnswer: () => Promise<void> = (): Promise<void> => Promise.resolve();

  /**
   * Property accounts
   *
   * @description
   * The unit of work to watch.
   *
   * @type {InMemoryAccounts}
   * @readonly
   */
  private readonly accounts: InMemoryAccounts;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the unit of work to watch.
   *
   * @param {InMemoryAccounts} accounts - The unit of work.
   * @constructor
   */
  public constructor(accounts: InMemoryAccounts) {
    super();
    this.accounts = accounts;
  }
  // #endregion

  // #region Methods
  /**
   * Method verify
   *
   * @description
   * Records the check, runs the hook, then compares as the fake hasher does.
   *
   * @param {string} password - The password.
   * @param {string | null} passwordHash - The stored hash.
   * @returns {Promise<boolean>} Whether it matches.
   */
  public override async verify(password: string, passwordHash: string | null): Promise<boolean> {
    this.checks.push(this.accounts.inTransaction);
    await this.beforeAnswer();
    return super.verify(password, passwordHash);
  }
  // #endregion
}

describe('VerifySignUp', () => {
  let accounts: InMemoryAccounts;
  let clock: FixedClock;
  let sessions: FakeSessionOpener;
  let hasher: WatchedPasswordHasher;
  let signUp: SignUp;
  let verify: VerifySignUp;
  let resend: ResendSignUpCode;

  /**
   * Function currentCode
   *
   * @description
   * The committed `email-verification` code of the address that is neither used nor replaced.
   *
   * @returns {OneTimeCodeState | undefined} The code.
   */
  function currentCode(): OneTimeCodeState | undefined {
    return accounts.state.codes.findLast(
      (code: OneTimeCodeState) => code.consumedAt === null && code.replacedAt === null,
    );
  }

  /**
   * Function verifiedEvents
   *
   * @description
   * The `user.email-verified.v1` events appended so far.
   *
   * @returns {RecordedEvent[]} The events.
   */
  function verifiedEvents(): RecordedEvent[] {
    return accounts.state.events.filter(
      (event: RecordedEvent) => event.name === 'user.email-verified.v1',
    );
  }

  beforeEach(async () => {
    accounts = new InMemoryAccounts();
    clock = new FixedClock('2026-11-08T13:07:00Z');
    sessions = new FakeSessionOpener(accounts);
    hasher = new WatchedPasswordHasher(accounts);
    const secrets: FakeCodeSecrets = new FakeCodeSecrets(['482913', '771204', '305518']);
    signUp = new SignUp(accounts, hasher, new FakeCompromisedPasswords(), secrets, clock);
    verify = new VerifySignUp(accounts, secrets, hasher, sessions, clock);
    resend = new ResendSignUpCode(accounts, secrets, clock);
    await signUp.execute(SIGN_UP);
  });

  it('verifies the address, opens the session inside the transaction and emits the verification', async () => {
    clock.advance(60_000);

    const issued: SessionIssuedView = await verify.execute(VERIFICATION);

    const user: User | undefined = accounts.userByEmail(VERIFICATION.email);
    expect(user?.isVerified).toBe(true);
    expect(user?.version).toBe(2);
    expect(issued.user).toEqual({
      id: user?.id,
      name: 'Camille Martin',
      email: 'camille.martin@ateliernord.fr',
      language: 'fr',
      displayName: null,
      jobTitle: null,
      timeZone: 'Europe/Paris',
      version: 2,
    });
    expect(issued.session.token).toBe('token-1');
    expect(sessions.opened).toEqual([
      {
        request: { userId: user?.id, persistent: false, client: VERIFICATION.client },
        inTransaction: true,
      },
    ]);
    expect(accounts.state.events.at(-1)).toMatchObject({ name: 'user.email-verified.v1' });
    expect(hasher.checks).toEqual([]);
  });

  it('verifies with the password of the sign-up, checked outside any transaction', async () => {
    const issued: SessionIssuedView = await verify.execute({
      ...VERIFICATION,
      password: SIGN_UP.password,
    });

    expect(issued.user.version).toBe(2);
    expect(accounts.userByEmail(VERIFICATION.email)?.isVerified).toBe(true);
    expect(hasher.checks).toEqual([false]);
    expect(sessions.opened).toEqual([expect.objectContaining({ inTransaction: true })]);
    expect(verifiedEvents()).toHaveLength(1);
  });

  it('refuses the right code with another password, and the code stops working', async () => {
    await expect(
      verify.execute({ ...VERIFICATION, password: OTHER_PASSWORD }),
    ).rejects.toMatchObject({ refusal: { reason: 'sign-up-replaced' } });

    expect(accounts.state.codes[0]?.consumedAt).not.toBeNull();
    await expect(
      verify.execute({ ...VERIFICATION, password: SIGN_UP.password }),
    ).rejects.toMatchObject({ refusal: { reason: 'code-expired' } });
    expect(accounts.userByEmail(VERIFICATION.email)?.isVerified).toBe(false);
    expect(sessions.opened).toEqual([]);
    expect(verifiedEvents()).toEqual([]);
  });

  describe('once a later sign-up replaced the pending account', () => {
    beforeEach(async () => {
      clock.advance(30_000);
      await signUp.execute({ ...SIGN_UP, name: 'C. Martin', password: OTHER_PASSWORD });
    });

    it('counts the accepted sign-ups of the address', () => {
      expect(accounts.userByEmail(VERIFICATION.email)?.signUpCount).toBe(2);
    });

    it('refuses the latest code with the password of the earlier sign-up, and the code stops working', async () => {
      await expect(
        verify.execute({ ...VERIFICATION, code: '771204', password: SIGN_UP.password }),
      ).rejects.toMatchObject({ refusal: { reason: 'sign-up-replaced' } });

      expect(currentCode()).toBeUndefined();
      await expect(
        verify.execute({ ...VERIFICATION, code: '771204', password: OTHER_PASSWORD }),
      ).rejects.toMatchObject({ refusal: { reason: 'code-expired' } });
      expect(accounts.userByEmail(VERIFICATION.email)?.isVerified).toBe(false);
      expect(sessions.opened).toEqual([]);
    });

    it('refuses the latest code without a password, and the code stops working', async () => {
      await expect(verify.execute({ ...VERIFICATION, code: '771204' })).rejects.toMatchObject({
        refusal: { reason: 'sign-up-replaced' },
      });

      expect(currentCode()).toBeUndefined();
      expect(hasher.checks).toEqual([]);
      expect(accounts.userByEmail(VERIFICATION.email)?.isVerified).toBe(false);
      expect(verifiedEvents()).toEqual([]);
    });

    it('verifies the latest code with the password of the latest sign-up', async () => {
      const issued: SessionIssuedView = await verify.execute({
        ...VERIFICATION,
        code: '771204',
        password: OTHER_PASSWORD,
      });

      expect(issued.user).toMatchObject({ name: 'C. Martin', version: 3 });
      expect(accounts.userByEmail(VERIFICATION.email)?.isVerified).toBe(true);
    });

    it('lets the owner sign up again and verify with its own password', async () => {
      await expect(
        verify.execute({ ...VERIFICATION, code: '771204', password: SIGN_UP.password }),
      ).rejects.toMatchObject({ refusal: { reason: 'sign-up-replaced' } });
      clock.advance(30_000);
      await signUp.execute(SIGN_UP);

      const issued: SessionIssuedView = await verify.execute({
        ...VERIFICATION,
        code: '305518',
        password: SIGN_UP.password,
      });

      expect(issued.user).toMatchObject({ name: 'Camille Martin', version: 4 });
      const user: User | undefined = accounts.userByEmail(VERIFICATION.email);
      expect(user?.signUpCount).toBe(3);
      expect(accounts.state.credentials.get(user?.id ?? '')).toBe(`hashed:${SIGN_UP.password}`);
    });

    it('answers a wrong code like before, whatever the password, without checking it', async () => {
      for (const password of [SIGN_UP.password, OTHER_PASSWORD, undefined]) {
        await expect(
          verify.execute({ ...VERIFICATION, code: '000000', password }),
        ).rejects.toMatchObject({ refusal: { reason: 'code-invalid' } });
      }

      expect(hasher.checks).toEqual([]);
      expect(currentCode()?.failedAttempts).toBe(3);
      await expect(
        verify.execute({ ...VERIFICATION, code: '771204', password: OTHER_PASSWORD }),
      ).resolves.toBeDefined();
    });
  });

  it('refuses the right password when a sign-up replaced the account while it was checked', async () => {
    hasher.beforeAnswer = async (): Promise<void> => {
      hasher.beforeAnswer = (): Promise<void> => Promise.resolve();
      clock.advance(30_000);
      await signUp.execute({ ...SIGN_UP, password: OTHER_PASSWORD });
    };

    await expect(
      verify.execute({ ...VERIFICATION, password: SIGN_UP.password }),
    ).rejects.toMatchObject({ refusal: { reason: 'sign-up-replaced' } });

    expect(accounts.userByEmail(VERIFICATION.email)?.isVerified).toBe(false);
    expect(sessions.opened).toEqual([]);
  });

  it('answers like a verified address when another code verified the account while the password was checked', async () => {
    hasher.beforeAnswer = async (): Promise<void> => {
      hasher.beforeAnswer = (): Promise<void> => Promise.resolve();
      clock.advance(30_000);
      await resend.execute({ email: VERIFICATION.email });
      await verify.execute({ ...VERIFICATION, code: '771204' });
    };

    await expect(
      verify.execute({ ...VERIFICATION, password: SIGN_UP.password }),
    ).rejects.toMatchObject({ refusal: { reason: 'code-invalid' } });

    expect(accounts.userByEmail(VERIFICATION.email)?.isVerified).toBe(true);
    expect(verifiedEvents()).toHaveLength(1);
    expect(sessions.opened).toHaveLength(1);
  });

  it('refuses a wrong code, and keeps the attempt counted', async () => {
    await expect(verify.execute({ ...VERIFICATION, code: '000000' })).rejects.toMatchObject({
      refusal: { reason: 'code-invalid' },
    });

    expect(accounts.state.codes[0]?.failedAttempts).toBe(1);
    expect(accounts.userByEmail(VERIFICATION.email)?.isVerified).toBe(false);
    expect(sessions.opened).toEqual([]);
  });

  it('refuses the right code after five wrong ones', async () => {
    for (let attempt: number = 0; attempt < 5; attempt += 1) {
      await expect(verify.execute({ ...VERIFICATION, code: '000000' })).rejects.toMatchObject({
        refusal: { reason: 'code-invalid' },
      });
    }

    await expect(verify.execute(VERIFICATION)).rejects.toMatchObject({
      refusal: { reason: 'code-expired' },
    });
  });

  it('refuses the code after 10 minutes, with or without the password', async () => {
    clock.advance(10 * 60_000);

    await expect(verify.execute(VERIFICATION)).rejects.toMatchObject({
      refusal: { reason: 'code-expired' },
    });
    await expect(
      verify.execute({ ...VERIFICATION, password: SIGN_UP.password }),
    ).rejects.toMatchObject({ refusal: { reason: 'code-expired' } });
    expect(hasher.checks).toEqual([]);
  });

  it('refuses the code of an older email once a new one was sent', async () => {
    clock.advance(30_000);
    await resend.execute({ email: VERIFICATION.email });

    await expect(verify.execute(VERIFICATION)).rejects.toMatchObject({
      refusal: { reason: 'code-expired' },
    });
    await expect(verify.execute({ ...VERIFICATION, code: '771204' })).resolves.toBeDefined();
  });

  it('answers like a wrong code for an unknown address and once verified', async () => {
    await expect(
      verify.execute({ ...VERIFICATION, email: 'nobody@ateliernord.fr' }),
    ).rejects.toMatchObject({ refusal: { reason: 'code-invalid' } });

    await verify.execute(VERIFICATION);
    await expect(
      verify.execute({ ...VERIFICATION, password: SIGN_UP.password }),
    ).rejects.toMatchObject({ refusal: { reason: 'code-invalid' } });
    expect(verifiedEvents()).toHaveLength(1);
  });
});
