/**
 * Interface OpenSessionOutput
 *
 * @description
 * The opened session and its token, which exists here only.
 */
export interface OpenSessionOutput {
  // #region Properties
  /**
   * Property token
   *
   * @description
   * The opaque token (256 random bits). A secret: never logged, stored only as its SHA-256 hash.
   *
   * @type {string}
   * @readonly
   */
  readonly token: string;

  /**
   * Property id
   *
   * @description
   * Id of the session.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property expiresAt
   *
   * @description
   * When the session ends at the latest.
   *
   * @type {Date}
   * @readonly
   */
  readonly expiresAt: Date;

  /**
   * Property persistent
   *
   * @description
   * Whether the cookie outlives the browser.
   *
   * @type {boolean}
   * @readonly
   */
  readonly persistent: boolean;
  // #endregion
}
