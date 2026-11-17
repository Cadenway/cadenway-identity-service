/**
 * Interface ApiTokenPosition
 *
 * @description
 * Where a page of tokens starts: after the token with this creation instant and id, in the order
 * of the list (the most recently created first).
 */
export interface ApiTokenPosition {
  // #region Properties
  /**
   * Property createdAt
   *
   * @description
   * Creation of the last token of the previous page.
   *
   * @type {Date}
   * @readonly
   */
  readonly createdAt: Date;

  /**
   * Property id
   *
   * @description
   * Its id, which breaks ties between tokens created at the same instant.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;
  // #endregion
}
