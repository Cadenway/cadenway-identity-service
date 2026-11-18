import type { PendingEmailChange } from '../../../../../domain/value-objects/email-change/pending-email-change.value-object.js';

/**
 * Interface EmailChangeRepository
 *
 * @description
 * The pending change of address of each account, one at most.
 */
export interface EmailChangeRepository {
  // #region Methods
  /**
   * Method find
   *
   * @description
   * Reads the pending change of an account, locking it.
   *
   * @param {string} userId - The account.
   * @returns {Promise<PendingEmailChange | null>} The change, or `null`.
   */
  find(userId: string): Promise<PendingEmailChange | null>;

  /**
   * Method save
   *
   * @description
   * Records a change as the pending change of its account, replacing the previous one.
   *
   * @param {PendingEmailChange} change - The change.
   * @returns {Promise<void>} Resolves once written.
   */
  save(change: PendingEmailChange): Promise<void>;

  /**
   * Method drop
   *
   * @description
   * Removes the pending change of an account, if any.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves once removed.
   */
  drop(userId: string): Promise<void>;
  // #endregion
}
