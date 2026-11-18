import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import { AccountLockedError } from '../../../../../domain/errors/password/account-locked.error.js';
import type { PasswordFailure } from '../../../../../domain/policies/password/password-failure.policy.js';
import type { PasswordLockout } from '../../../../../domain/policies/password/password-lockout.policy.js';
import { EmailAddress } from '../../../../../domain/value-objects/email/email-address.value-object.js';
import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { Refusal } from '../../../../models/authentication/refusal.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { DeviceReader } from '../../../../ports/outbound/device/accounts/device-reader.port.js';
import type { SessionOpener } from '../../../../ports/outbound/identity/sessions/session-opener.port.js';
import type { PasswordHasher } from '../../../../ports/outbound/security/authentication/password-hasher.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { SignInOutcome } from '../../../../projections/authentication/sign-in-outcome.projection.js';
import { completeFirstFactor } from '../../../../services/two-step/first-factor.service.js';
import { settlePasswordCheck } from '../../../../services/password/password-attempts.service.js';
import type { SignInWithPasswordInput } from './sign-in-with-password.input.js';
import type { TrustedDevices } from '../../../../ports/outbound/identity/sessions/trusted-devices.port.js';
import type { ChallengeTokens } from '../../../../ports/outbound/security/two-step/challenge-tokens.port.js';

/**
 * Class SignInWithPassword
 *
 * @description
 * Checks an address and its password and opens a session (`POST /internal/v1/auth/sign-in`), in
 * three steps, so the hash computation never holds a connection of the pool or a row lock:
 *
 * 1. A transaction locks the lockout row of the address, refuses during a lockout
 *    (`auth.account-locked` with `lockedUntil`, without checking the password), counts the attempt
 *    as a failure in advance, reads the account and its hash, and commits. Concurrent attempts of
 *    one address are therefore all counted, one after the other.
 * 2. The password is checked outside any transaction; against a decoy hash when no account uses
 *    the address, so the time does not tell. A wrong one keeps its counted failure:
 *    `auth.invalid-credentials` with `remainingAttempts`, or `auth.account-locked` for the failure
 *    that used the last attempt.
 * 3. For the right password, a second transaction resets the count, locks the account and, for a
 *    verified one, opens the session (`completeSignIn`: "Nouvelle connexion", and the cancellation of
 *    a scheduled deletion), or, for an account with two-step verification on a device it does not
 *    trust, issues its challenge instead (`completeFirstFactor`, P2c-2); an unverified account
 *    answers `auth.email-not-verified`, and an account deleted meanwhile answers like a wrong
 *    password.
 */
export class SignInWithPassword {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transaction of the sign-in.
   *
   * @type {AccountsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: AccountsUnitOfWork;

  /**
   * Property hasher
   *
   * @description
   * Checks the password.
   *
   * @type {PasswordHasher}
   * @readonly
   */
  private readonly hasher: PasswordHasher;

  /**
   * Property sessions
   *
   * @description
   * Opens the session.
   *
   * @type {SessionOpener}
   * @readonly
   */
  private readonly sessions: SessionOpener;

  /**
   * Property clock
   *
   * @description
   * The time of the sign-in.
   *
   * @type {Clock}
   * @readonly
   */
  private readonly clock: Clock;

  /**
   * Property devices
   *
   * @description
   * Reads the device of the browser for the security e-mails.
   *
   * @type {DeviceReader}
   * @readonly
   */
  private readonly devices: DeviceReader;

  /**
   * Property trustedDevices
   *
   * @description
   * The trusted devices of the account, whose sign-ins skip the challenge.
   *
   * @type {TrustedDevices}
   * @readonly
   */
  private readonly trustedDevices: TrustedDevices;

  /**
   * Property challengeTokens
   *
   * @description
   * Draws the token of a two-step challenge.
   *
   * @type {ChallengeTokens}
   * @readonly
   */
  private readonly challengeTokens: ChallengeTokens;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the ports of the sign-in.
   *
   * @param {AccountsUnitOfWork} unitOfWork - The transaction of the sign-in.
   * @param {PasswordHasher} hasher - Checks the password.
   * @param {SessionOpener} sessions - Opens the session.
   * @param {Clock} clock - The time of the sign-in.
   * @param {DeviceReader} devices - Reads the device of the browser.
   * @param {TrustedDevices} trustedDevices - The trusted devices of the account, whose sign-ins skip the challenge.
   * @param {ChallengeTokens} challengeTokens - Draws the token of a two-step challenge.
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    hasher: PasswordHasher,
    sessions: SessionOpener,
    clock: Clock,
    devices: DeviceReader,
    trustedDevices: TrustedDevices,
    challengeTokens: ChallengeTokens,
  ) {
    this.unitOfWork = unitOfWork;
    this.hasher = hasher;
    this.sessions = sessions;
    this.clock = clock;
    this.devices = devices;
    this.trustedDevices = trustedDevices;
    this.challengeTokens = challengeTokens;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Signs the account of the address in with its password.
   *
   * @param {SignInWithPasswordInput} input - The address, the password and the browser.
   * @returns {Promise<SignInOutcome>} The session, its token and the account, or the two-step
   * challenge of an account with two-step verification on a device it does not trust.
   * @throws {AccountRefusal} `auth.account-locked`, `auth.invalid-credentials` or
   * `auth.email-not-verified`.
   */
  public async execute(input: SignInWithPasswordInput): Promise<SignInOutcome> {
    const email: EmailAddress = EmailAddress.of(input.email);
    const now: Date = this.clock.now();
    const attempt: CountedAttempt | Refusal = await this.unitOfWork.run(
      (store: AccountsStore): Promise<CountedAttempt | Refusal> => this.count(store, email, now),
    );
    if ('reason' in attempt) {
      throw new AccountRefusal(attempt);
    }
    const matches: boolean = await this.hasher.verify(input.password, attempt.passwordHash);
    if (attempt.user === null || !matches) {
      throw new AccountRefusal(wrongCredentials(attempt.failure));
    }
    const userId: string = attempt.user.id;
    const passwordHash: string | null = attempt.passwordHash;
    const failure: PasswordFailure = attempt.failure;
    const outcome: SignInOutcome | Refusal = await this.unitOfWork.run(
      async (store: AccountsStore): Promise<SignInOutcome | Refusal> => {
        const user: User | 'account-gone' | 'password-moved' = await settlePasswordCheck(
          store,
          userId,
          email,
          passwordHash,
        );
        if (typeof user === 'string') {
          return wrongCredentials(failure);
        }
        if (!user.isVerified) {
          return { reason: 'email-not-verified' };
        }
        return completeFirstFactor(
          store,
          {
            sessions: this.sessions,
            devices: this.devices,
            trustedDevices: this.trustedDevices,
            challengeTokens: this.challengeTokens,
          },
          user,
          {
            persistent: input.rememberMe,
            client: input.client,
            trustedDeviceToken: input.trustedDeviceToken,
          },
          now,
        );
      },
    );
    if ('reason' in outcome) {
      throw new AccountRefusal(outcome);
    }
    return outcome;
  }

  /**
   * Method count
   *
   * @description
   * The first transaction: refuses during a lockout, otherwise counts the attempt as a failure in
   * advance and reads the account and its hash.
   *
   * @param {AccountsStore} store - The repositories of the transaction.
   * @param {EmailAddress} email - The normalized address.
   * @param {Date} now - The instant of the sign-in.
   * @returns {Promise<CountedAttempt | Refusal>} The counted attempt, or `auth.account-locked`.
   */
  private async count(
    store: AccountsStore,
    email: EmailAddress,
    now: Date,
  ): Promise<CountedAttempt | Refusal> {
    const lockout: PasswordLockout = await store.signInAttempts.lock(email);
    try {
      lockout.assertUnlocked(now);
    } catch (error) {
      if (error instanceof AccountLockedError) {
        return { reason: 'account-locked', lockedUntil: error.lockedUntil };
      }
      throw error;
    }
    const failure: PasswordFailure = lockout.recordFailure(now);
    await store.signInAttempts.save(email, failure.lockout);
    const user: User | null = await store.users.findByEmail(email, false);
    const passwordHash: string | null =
      user === null ? null : await store.credentials.findHash(user.id);
    return { failure, user, passwordHash };
  }
  // #endregion
}

/**
 * Function wrongCredentials
 *
 * @description
 * The answer to a wrong password, or to a password that stopped being the one of the account
 * during its check: the attempt counted in advance stays.
 *
 * @param {PasswordFailure} failure - The attempt counted in advance.
 * @returns {Refusal} `auth.invalid-credentials`, or `auth.account-locked` when it locks.
 */
function wrongCredentials(failure: PasswordFailure): Refusal {
  return failure.lockedUntil === null
    ? { reason: 'invalid-credentials', remainingAttempts: failure.remainingAttempts }
    : { reason: 'account-locked', lockedUntil: failure.lockedUntil };
}

/**
 * Interface CountedAttempt
 *
 * @description
 * A password sign-in counted as a failure, with what its check needs.
 */
interface CountedAttempt {
  // #region Properties
  /**
   * Property failure
   *
   * @description
   * The answer if the password turns out wrong.
   *
   * @type {PasswordFailure}
   * @readonly
   */
  readonly failure: PasswordFailure;

  /**
   * Property user
   *
   * @description
   * The account of the address, or `null`.
   *
   * @type {User | null}
   * @readonly
   */
  readonly user: User | null;

  /**
   * Property passwordHash
   *
   * @description
   * The stored hash of its password, or `null`.
   *
   * @type {string | null}
   * @readonly
   */
  readonly passwordHash: string | null;
  // #endregion
}
