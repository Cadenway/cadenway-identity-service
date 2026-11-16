/**
 * Interface OpenSessionInput
 *
 * @description
 * The session a successful sign-in opens.
 */
export interface OpenSessionInput {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * Verified account the session signs in.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property persistent
   *
   * @description
   * Whether the cookie outlives the browser (`rememberMe`).
   *
   * @type {boolean}
   * @readonly
   */
  readonly persistent: boolean;

  /**
   * Property client
   *
   * @description
   * The browser, as the gateway saw it.
   *
   * @type {{ readonly ipAddress: string; readonly userAgent: string | null }}
   * @readonly
   */
  readonly client: { readonly ipAddress: string; readonly userAgent: string | null };
  // #endregion
}
