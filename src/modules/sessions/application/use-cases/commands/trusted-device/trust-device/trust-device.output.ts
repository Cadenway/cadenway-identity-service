/**
 * Interface TrustDeviceOutput
 *
 * @description
 * The trusted device, returned once (`TrustedDevice` of the contract): the gateway writes its token
 * into `__Host-cw_trusted_device`.
 */
export interface TrustDeviceOutput {
  // #region Properties
  /**
   * Property token
   *
   * @description
   * The device token, 256 random bits in base64url. A secret, never logged; only its SHA-256 is
   * stored.
   *
   * @type {string}
   * @readonly
   */
  readonly token: string;

  /**
   * Property expiresAt
   *
   * @description
   * When the device stops being trusted, 30 days later.
   *
   * @type {Date}
   * @readonly
   */
  readonly expiresAt: Date;
  // #endregion
}
