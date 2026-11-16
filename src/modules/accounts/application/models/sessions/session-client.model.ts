/**
 * Interface SessionClient
 *
 * @description
 * The browser a session is opened for, as the gateway saw it (`Client` of the contract).
 */
export interface SessionClient {
  // #region Properties
  /**
   * Property ipAddress
   *
   * @description
   * IPv4 or IPv6 address of the browser.
   *
   * @type {string}
   * @readonly
   */
  readonly ipAddress: string;

  /**
   * Property userAgent
   *
   * @description
   * `User-Agent` header of the browser, `null` when it sent none.
   *
   * @type {string | null}
   * @readonly
   */
  readonly userAgent: string | null;
  // #endregion
}
