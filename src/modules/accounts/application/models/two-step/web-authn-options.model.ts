/**
 * Interface WebAuthnOptions
 *
 * @description
 * Options a browser passes to WebAuthn (`PublicKeyCredentialCreationOptionsJSON` or
 * `PublicKeyCredentialRequestOptionsJSON`, as `@simplewebauthn/server` generates them), with their
 * challenge, which the account keeps to verify the answer.
 */
export interface WebAuthnOptions {
  // #region Properties
  /**
   * Property options
   *
   * @description
   * The options, passed on as they are.
   *
   * @type {Readonly<Record<string, unknown>>}
   * @readonly
   */
  readonly options: Readonly<Record<string, unknown>>;

  /**
   * Property challenge
   *
   * @description
   * Their WebAuthn challenge, base64url, single use.
   *
   * @type {string}
   * @readonly
   */
  readonly challenge: string;
  // #endregion
}
