import type { PasswordResetLinkIssue } from '../../../../../domain/aggregates/password-reset/password-reset-link-issue.aggregate.js';
import type { PasswordResetLink } from '../../../../../domain/aggregates/password-reset/password-reset-link.aggregate.js';

/**
 * Interface PasswordResetLinkRepository
 *
 * @description
 * The password reset links, found by the hash of their token, never by the token.
 */
export interface PasswordResetLinkRepository {
  // #region Methods
  /**
   * Method findByTokenHash
   *
   * @description
   * Reads the link of a token hash.
   *
   * @param {string} tokenHash - SHA-256 of the token.
   * @param {boolean} forUpdate - Whether to lock the row.
   * @returns {Promise<PasswordResetLink | null>} The link, or `null`.
   */
  findByTokenHash(tokenHash: string, forUpdate: boolean): Promise<PasswordResetLink | null>;

  /**
   * Method replaceCurrent
   *
   * @description
   * Makes the current link of an account, if any, stop working.
   *
   * @param {string} userId - The account.
   * @param {Date} now - When it was replaced.
   * @returns {Promise<void>} Resolves once written.
   */
  replaceCurrent(userId: string, now: Date): Promise<void>;

  /**
   * Method insert
   *
   * @description
   * Stores a new link.
   *
   * @param {PasswordResetLinkIssue} issue - The link.
   * @returns {Promise<PasswordResetLink>} The stored link, with its id.
   */
  insert(issue: PasswordResetLinkIssue): Promise<PasswordResetLink>;

  /**
   * Method save
   *
   * @description
   * Records that a link was used.
   *
   * @param {PasswordResetLink} link - The used link.
   * @returns {Promise<void>} Resolves once written.
   */
  save(link: PasswordResetLink): Promise<void>;
  // #endregion
}
