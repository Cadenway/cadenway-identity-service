/**
 * Interface TrustedDeviceGrant
 *
 * @description
 * A browser made a trusted device by the answer of a challenge with `trustDevice` (`TrustedDevice`
 * of the contract): the gateway writes the token into `__Host-cw_trusted_device`.
 */
export interface TrustedDeviceGrant {
  // #region Properties
  /**
   * Property token
   *
   * @description
   * The device token, returned once. A secret, never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly token: string;

  /**
   * Property expiresAt
   *
   * @description
   * When it stops being trusted, 30 days later.
   *
   * @type {Date}
   * @readonly
   */
  readonly expiresAt: Date;
  // #endregion
}
