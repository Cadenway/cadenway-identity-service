import type { CodeRequestThrottle } from '../../domain/code-request-throttle.js';
import type { EmailAddress } from '../../domain/email-address.js';
import type {
  OneTimeCode,
  OneTimeCodeIssue,
  OneTimeCodePurpose,
} from '../../domain/one-time-code.js';
import type { PasswordLockout } from '../../domain/password-lockout.js';
import type { User, UserRegistration } from '../../domain/user.js';

/**
 * Interface UserRepository
 *
 * @description
 * The accounts, bound to the transaction of a unit of work. An account belongs to no organization:
 * every read names the account by its id or its normalized address.
 */
export interface UserRepository {
  // #region Methods
  /**
   * Method findByEmail
   *
   * @description
   * Loads the account of an address, locking its row until the end of the transaction when
   * `forUpdate` is set.
   *
   * @param {EmailAddress} email - The normalized address.
   * @param {boolean} forUpdate - Whether to lock the row for a change.
   * @returns {Promise<User | null>} The account, or `null` when none uses the address.
   */
  findByEmail(email: EmailAddress, forUpdate: boolean): Promise<User | null>;

  /**
   * Method findById
   *
   * @description
   * Loads an account by its id.
   *
   * @param {string} id - Id of the account.
   * @returns {Promise<User | null>} The account, or `null` when the id is unknown.
   */
  findById(id: string): Promise<User | null>;

  /**
   * Method insert
   *
   * @description
   * Stores a new account; PostgreSQL assigns its id.
   *
   * @param {UserRegistration} registration - The account to create.
   * @returns {Promise<User>} The stored account, with its id.
   */
  insert(registration: UserRegistration): Promise<User>;

  /**
   * Method update
   *
   * @description
   * Writes a changed account whose stored version is the one before `user.version`.
   *
   * @param {User} user - The account after the change.
   * @returns {Promise<void>} Resolves once written.
   * @throws {Error} When the stored version moved meanwhile: a defect, since the row is locked.
   */
  update(user: User): Promise<void>;
  // #endregion
}

/**
 * Interface PasswordCredentialRepository
 *
 * @description
 * The password hash of each account, bound to the transaction of a unit of work.
 */
export interface PasswordCredentialRepository {
  // #region Methods
  /**
   * Method findHash
   *
   * @description
   * Reads the encoded hash of the password of an account.
   *
   * @param {string} userId - Id of the account.
   * @returns {Promise<string | null>} The encoded hash, or `null` when the account has no password.
   */
  findHash(userId: string): Promise<string | null>;

  /**
   * Method save
   *
   * @description
   * Sets the password hash of an account, replacing the previous one.
   *
   * @param {string} userId - Id of the account.
   * @param {string} passwordHash - The encoded hash.
   * @returns {Promise<void>} Resolves once written.
   */
  save(userId: string, passwordHash: string): Promise<void>;
  // #endregion
}

/**
 * Interface OneTimeCodeRepository
 *
 * @description
 * The one-time codes, bound to the transaction of a unit of work.
 */
export interface OneTimeCodeRepository {
  // #region Methods
  /**
   * Method findCurrent
   *
   * @description
   * Loads the latest code of an account and a purpose that was neither used nor replaced, locking
   * it, whether or not it has expired.
   *
   * @param {string} userId - Id of the account.
   * @param {OneTimeCodePurpose} purpose - What the code proves.
   * @returns {Promise<OneTimeCode | null>} The code, or `null` when none was issued or the last was
   * used.
   */
  findCurrent(userId: string, purpose: OneTimeCodePurpose): Promise<OneTimeCode | null>;

  /**
   * Method replaceCurrent
   *
   * @description
   * Marks the current code of an account and a purpose as replaced, before a new one is issued.
   *
   * @param {string} userId - Id of the account.
   * @param {OneTimeCodePurpose} purpose - What the codes prove.
   * @param {Date} now - When the codes are replaced.
   * @returns {Promise<void>} Resolves once written.
   */
  replaceCurrent(userId: string, purpose: OneTimeCodePurpose, now: Date): Promise<void>;

  /**
   * Method insert
   *
   * @description
   * Stores a new code; PostgreSQL assigns its id.
   *
   * @param {OneTimeCodeIssue} issue - The code to store.
   * @returns {Promise<OneTimeCode>} The stored code, with its id.
   */
  insert(issue: OneTimeCodeIssue): Promise<OneTimeCode>;

  /**
   * Method save
   *
   * @description
   * Writes the counted attempts and the use of a code.
   *
   * @param {OneTimeCode} code - The code after the check.
   * @returns {Promise<void>} Resolves once written.
   */
  save(code: OneTimeCode): Promise<void>;

  /**
   * Method endedWithHash
   *
   * @description
   * Whether an earlier code of the account and purpose, used or replaced, has this hash: a
   * candidate taken from an older email answers "expired" rather than "wrong".
   *
   * @param {string} userId - Id of the account.
   * @param {OneTimeCodePurpose} purpose - What the code proves.
   * @param {string} codeHash - Keyed hash of the candidate.
   * @returns {Promise<boolean>} Whether such a code exists.
   */
  endedWithHash(userId: string, purpose: OneTimeCodePurpose, codeHash: string): Promise<boolean>;
  // #endregion
}

/**
 * Interface CodeRequestRepository
 *
 * @description
 * The throttle of the code requests of each address, bound to the transaction of a unit of work.
 */
export interface CodeRequestRepository {
  // #region Methods
  /**
   * Method lock
   *
   * @description
   * Takes the lock of an address until the end of the transaction, creating its row when needed,
   * and reads its throttle. Two code requests or sign-ups of the same address therefore run one
   * after the other: the throttle, the account and its codes are read and written by one of them at
   * a time.
   *
   * @param {EmailAddress} email - The normalized address.
   * @returns {Promise<CodeRequestThrottle>} The throttle of the address.
   */
  lock(email: EmailAddress): Promise<CodeRequestThrottle>;

  /**
   * Method save
   *
   * @description
   * Writes the throttle after an accepted request, after `lock` in the same transaction.
   *
   * @param {EmailAddress} email - The normalized address.
   * @param {CodeRequestThrottle} throttle - The throttle after the request.
   * @returns {Promise<void>} Resolves once written.
   */
  save(email: EmailAddress, throttle: CodeRequestThrottle): Promise<void>;
  // #endregion
}

/**
 * Interface SignInAttemptRepository
 *
 * @description
 * The password lockout of each address, bound to the transaction of a unit of work.
 */
export interface SignInAttemptRepository {
  // #region Methods
  /**
   * Method lock
   *
   * @description
   * Takes the lock of an address until the end of the transaction and reads its lockout, so two
   * password sign-ins of one address are counted one after the other.
   *
   * @param {EmailAddress} email - The normalized address.
   * @returns {Promise<PasswordLockout>} The lockout, clear when nothing is counted.
   */
  lock(email: EmailAddress): Promise<PasswordLockout>;

  /**
   * Method save
   *
   * @description
   * Writes the lockout of an address after `lock`. The row is kept when clear, so a sign-in waiting
   * on its lock always finds it.
   *
   * @param {EmailAddress} email - The normalized address.
   * @param {PasswordLockout} lockout - The lockout to store.
   * @returns {Promise<void>} Resolves once written.
   */
  save(email: EmailAddress, lockout: PasswordLockout): Promise<void>;
  // #endregion
}
