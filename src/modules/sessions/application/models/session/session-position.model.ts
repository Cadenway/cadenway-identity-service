/**
 * Interface SessionPosition
 *
 * @description
 * Where a page of the list of the sessions ends: the sign-in and the id of its last session, in
 * the order of the list (the most recent sign-in first, then by id).
 */
export interface SessionPosition {
  // #region Properties
  /**
   * Property signedInAt
   *
   * @description
   * Sign-in of the last session of the page.
   *
   * @type {Date}
   * @readonly
   */
  readonly signedInAt: Date;

  /**
   * Property id
   *
   * @description
   * Id of the last session of the page.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;
  // #endregion
}
