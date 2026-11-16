/**
 * Interface OpenedSession
 *
 * @description
 * A session just opened, with its token, which exists here only.
 */
export interface OpenedSession {
  // #region Properties
  /**
   * Property token
   *
   * @description
   * The opaque session token, returned once. A secret: never logged, never stored in clear.
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
   * When the session ends at the latest, whatever its activity.
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
