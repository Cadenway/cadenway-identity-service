/**
 * Interface TwoStepEnrollmentRepository
 *
 * @description
 * Which accounts have two-step verification (`two_step_enrollments`), as the accounts module
 * records it.
 */
export interface TwoStepEnrollmentRepository {
  // #region Methods
  /**
   * Method isEnrolled
   *
   * @description
   * Whether an account has two-step verification.
   *
   * @param {string} userId - The account.
   * @returns {Promise<boolean>} `true` while it is on.
   */
  isEnrolled(userId: string): Promise<boolean>;

  /**
   * Method enroll
   *
   * @description
   * Records that an account has two-step verification from `now`; again does nothing.
   *
   * @param {string} userId - The account.
   * @param {Date} now - When it turned on.
   * @returns {Promise<void>} Resolves once written.
   */
  enroll(userId: string, now: Date): Promise<void>;

  /**
   * Method unenroll
   *
   * @description
   * Records that an account has no two-step verification; again does nothing.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves once written.
   */
  unenroll(userId: string): Promise<void>;

  /**
   * Method enrolledAmong
   *
   * @description
   * The accounts of a list that have two-step verification, in one query.
   *
   * @param {readonly string[]} userIds - The accounts.
   * @returns {Promise<ReadonlySet<string>>} Those with two-step verification.
   */
  enrolledAmong(userIds: readonly string[]): Promise<ReadonlySet<string>>;
  // #endregion
}
