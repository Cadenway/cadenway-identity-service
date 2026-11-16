/**
 * Interface GetUserInput
 *
 * @description
 * Who reads which account.
 */
export interface GetUserInput {
  // #region Properties
  /**
   * Property actorUserId
   *
   * @description
   * The user of the verified internal token, never a value of the request.
   *
   * @type {string}
   * @readonly
   */
  readonly actorUserId: string;

  /**
   * Property userId
   *
   * @description
   * The account asked for.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;
  // #endregion
}
