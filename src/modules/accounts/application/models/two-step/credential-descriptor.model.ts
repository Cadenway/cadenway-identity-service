/**
 * Interface CredentialDescriptor
 *
 * @description
 * A key of the account named in WebAuthn options (`excludeCredentials`, `allowCredentials`).
 */
export interface CredentialDescriptor {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * The credential id, base64url.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property transports
   *
   * @description
   * Its transports.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly transports: readonly string[];
  // #endregion
}
