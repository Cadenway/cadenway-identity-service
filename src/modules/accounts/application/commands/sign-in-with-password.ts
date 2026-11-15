import { EmailAddress } from '../../domain/email-address.js';
import { AccountLockedError } from '../../domain/errors.js';
import type { PasswordFailure, PasswordLockout } from '../../domain/password-lockout.js';
import type { User } from '../../domain/user.js';
import { AccountRefusal } from '../account-refusal.js';
import type { Refusal } from '../account-refusal.js';
import { toAccountView } from '../account-views.js';
import type { SessionIssuedView } from '../account-views.js';
import type { AccountsStore, AccountsUnitOfWork } from '../ports/accounts-unit-of-work.port.js';
import type { Clock } from '../ports/clock.port.js';
import type { PasswordHasher } from '../ports/password-hasher.port.js';
import type { OpenedSession, SessionClient, SessionOpener } from '../ports/session-opener.port.js';

/**
 * Interface PasswordSignInInput
 *
 * @description
 * A sign-in with a password, as the Main screen sends it (`PasswordSignIn` of the contract).
 */
export interface PasswordSignInInput {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * The address, as typed.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property password
   *
   * @description
   * The password; never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly password: string;

  /**
   * Property rememberMe
   *
   * @description
   * Whether the session outlives the browser ("Rester connecté pendant 30 jours").
   *
   * @type {boolean}
   * @readonly
   */
  readonly rememberMe: boolean;

  /**
   * Property client
   *
   * @description
   * The browser the session is opened for.
   *
   * @type {SessionClient}
   * @readonly
   */
  readonly client: SessionClient;
  // #endregion
}

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
 * 3. For the right password, a second transaction resets the count and, for a verified account,
 *    opens the session; an unverified account answers `auth.email-not-verified`.
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
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    hasher: PasswordHasher,
    sessions: SessionOpener,
    clock: Clock,
  ) {
    this.unitOfWork = unitOfWork;
    this.hasher = hasher;
    this.sessions = sessions;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Signs the account of the address in with its password.
   *
   * @param {PasswordSignInInput} input - The address, the password and the browser.
   * @returns {Promise<SessionIssuedView>} The session, its token and the account.
   * @throws {AccountRefusal} `auth.account-locked`, `auth.invalid-credentials` or
   * `auth.email-not-verified`.
   */
  public async execute(input: PasswordSignInInput): Promise<SessionIssuedView> {
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
      throw new AccountRefusal(
        attempt.failure.lockedUntil === null
          ? { reason: 'invalid-credentials', remainingAttempts: attempt.failure.remainingAttempts }
          : { reason: 'account-locked', lockedUntil: attempt.failure.lockedUntil },
      );
    }
    const user: User = attempt.user;
    const outcome: SessionIssuedView | Refusal = await this.unitOfWork.run(
      async (store: AccountsStore): Promise<SessionIssuedView | Refusal> => {
        const lockout: PasswordLockout = await store.signInAttempts.lock(email);
        await store.signInAttempts.save(email, lockout.recordSuccess());
        if (!user.isVerified) {
          return { reason: 'email-not-verified' };
        }
        const session: OpenedSession = await this.sessions.open({
          userId: user.id,
          persistent: input.rememberMe,
          client: input.client,
        });
        return { session, user: toAccountView(user) };
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
