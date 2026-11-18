/**
 * Interface RecordTwoStepVerificationInput
 *
 * @description
 * An account whose two-step verification turned on or off, as the accounts module records it in its
 * own transaction.
 */
export interface RecordTwoStepVerificationInput {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * The account.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property enabled
   *
   * @description
   * Whether it has two-step verification from now.
   *
   * @type {boolean}
   * @readonly
   */
  readonly enabled: boolean;
  // #endregion
}
