/**
 * Interface GetTwoStepVerificationInput
 *
 * @description
 * A reading of the two-step verification of an account.
 */
export interface GetTwoStepVerificationInput {
  // #region Properties
  /**
   * Property actorUserId
   *
   * @description
   * The actor, from the verified internal token.
   *
   * @type {string}
   * @readonly
   */
  readonly actorUserId: string;

  /**
   * Property userId
   *
   * @description
   * The account of the path.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;
  // #endregion
}
