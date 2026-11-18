/**
 * Interface InspectPasswordResetLinkOutput
 *
 * @description
 * The account of a usable link ("Pour le compte <email>.") and the sessions a reset would close
 * ("3 appareils connectés seront déconnectés").
 */
export interface InspectPasswordResetLinkOutput {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * Address of the account of the link.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property expiresAt
   *
   * @description
   * When the link stops working.
   *
   * @type {Date}
   * @readonly
   */
  readonly expiresAt: Date;

  /**
   * Property sessionCount
   *
   * @description
   * Open sessions of the account.
   *
   * @type {number}
   * @readonly
   */
  readonly sessionCount: number;
  // #endregion
}
