/**
 * Interface RevokeUserSessionsInput
 *
 * @description
 * The sessions of a person a reset or the scheduling of the deletion of the account closes.
 */
export interface RevokeUserSessionsInput {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * The person.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property exceptSessionId
   *
   * @description
   * The session that stays open, or `null` to revoke them all.
   *
   * @type {string | null}
   * @readonly
   */
  readonly exceptSessionId: string | null;
  // #endregion
}
