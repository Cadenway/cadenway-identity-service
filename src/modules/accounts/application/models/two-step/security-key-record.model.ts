/**
 * Interface SecurityKeyRecord
 *
 * @description
 * A stored security key of an account, as the verification of an assertion and its card need it.
 */
export interface SecurityKeyRecord {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the key.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * The name the person gave it.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property credentialId
   *
   * @description
   * The WebAuthn credential id, base64url.
   *
   * @type {string}
   * @readonly
   */
  readonly credentialId: string;

  /**
   * Property publicKey
   *
   * @description
   * Its COSE public key, base64url.
   *
   * @type {string}
   * @readonly
   */
  readonly publicKey: string;

  /**
   * Property counter
   *
   * @description
   * Its signature counter.
   *
   * @type {number}
   * @readonly
   */
  readonly counter: number;

  /**
   * Property transports
   *
   * @description
   * How a browser reaches it (`usb`, `nfc`, `internal`...).
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly transports: readonly string[];

  /**
   * Property createdAt
   *
   * @description
   * When it was registered.
   *
   * @type {Date}
   * @readonly
   */
  readonly createdAt: Date;

  /**
   * Property lastUsedAt
   *
   * @description
   * When it last answered a challenge, `null` never.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly lastUsedAt: Date | null;
  // #endregion
}
