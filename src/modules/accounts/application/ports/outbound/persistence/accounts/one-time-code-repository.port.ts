import type { OneTimeCodeIssue } from '../../../../../domain/aggregates/one-time-codes/one-time-code-issue.aggregate.js';
import type { OneTimeCode } from '../../../../../domain/aggregates/one-time-codes/one-time-code.aggregate.js';
import type { OneTimeCodePurpose } from '../../../../../domain/value-objects/one-time-code-purpose/one-time-code-purpose.value-object.js';

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

  /**
   * Method replaceAllCurrent
   *
   * @description
   * Makes every current code of an account stop working, whatever its purpose: a new address
   * leaves no code of the previous one usable.
   *
   * @param {string} userId - Id of the account.
   * @param {Date} now - When they were replaced.
   * @returns {Promise<void>} Resolves once written.
   */
  replaceAllCurrent(userId: string, now: Date): Promise<void>;
  // #endregion
}
