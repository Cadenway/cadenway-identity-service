/**
 * Interface TwoStepEnrollments
 *
 * @description
 * The fact the sessions module applies its rules from: whether an account has two-step
 * verification. Recorded in the transaction that turns it on or off, which the call joins.
 */
export interface TwoStepEnrollments {
  // #region Methods
  /**
   * Method record
   *
   * @description
   * Records whether the account has two-step verification.
   *
   * @param {string} userId - The account.
   * @param {boolean} enabled - Whether it is on from now.
   * @returns {Promise<void>} Resolves once written.
   */
  record(userId: string, enabled: boolean): Promise<void>;
  // #endregion
}
