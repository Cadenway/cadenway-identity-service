/**
 * Interface UnitOfWorkOptions
 *
 * @description
 * How the transaction of a unit of work is opened.
 */
export interface UnitOfWorkOptions {
  // #region Properties
  /**
   * Property readOnly
   *
   * @description
   * Opens a read-only transaction, for a query.
   *
   * @type {boolean | undefined}
   * @readonly
   */
  readonly readOnly?: boolean;
  // #endregion
}
