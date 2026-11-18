import type { TwoStepVerification } from '../../../../../domain/aggregates/two-step/two-step-verification.aggregate.js';

/**
 * Interface TwoStepVerificationRepository
 *
 * @description
 * The two-step verification of the accounts (`two_step_verifications`), one row per account while
 * it is on, keyed by the account.
 */
export interface TwoStepVerificationRepository {
  // #region Methods
  /**
   * Method find
   *
   * @description
   * Reads the two-step verification of an account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<TwoStepVerification | null>} It, or `null` while it is off.
   */
  find(userId: string): Promise<TwoStepVerification | null>;

  /**
   * Method lock
   *
   * @description
   * Reads and locks it until the end of the transaction, after the account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<TwoStepVerification | null>} It, or `null` while it is off.
   */
  lock(userId: string): Promise<TwoStepVerification | null>;

  /**
   * Method insert
   *
   * @description
   * Stores it when two-step verification turns on.
   *
   * @param {TwoStepVerification} verification - The new two-step verification.
   * @returns {Promise<void>} Resolves once written.
   */
  insert(verification: TwoStepVerification): Promise<void>;

  /**
   * Method update
   *
   * @description
   * Stores a change: its app, its accepted time step, its count of wrong answers.
   *
   * @param {TwoStepVerification} verification - It after the change.
   * @returns {Promise<void>} Resolves once written.
   */
  update(verification: TwoStepVerification): Promise<void>;

  /**
   * Method delete
   *
   * @description
   * Deletes it when two-step verification turns off.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves once deleted.
   */
  delete(userId: string): Promise<void>;
  // #endregion
}
