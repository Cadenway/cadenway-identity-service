/**
 * Interface WebAuthnOptionsView
 *
 * @description
 * WebAuthn options for the browser and when they expire (`SecurityKeyRegistration`,
 * `SecurityKeyAssertionOptions` of the contract).
 */
export interface WebAuthnOptionsView {
  // #region Properties
  /**
   * Property options
   *
   * @description
   * The options, as `@simplewebauthn/server` generated them.
   *
   * @type {Readonly<Record<string, unknown>>}
   * @readonly
   */
  readonly options: Readonly<Record<string, unknown>>;

  /**
   * Property expiresAt
   *
   * @description
   * 5 minutes after they were issued.
   *
   * @type {Date}
   * @readonly
   */
  readonly expiresAt: Date;
  // #endregion
}
