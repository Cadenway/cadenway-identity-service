/**
 * Interface CheckTrustedDeviceInput
 *
 * @description
 * The device cookie a sign-in forwarded, checked against the trusted devices of the account of the
 * sign-in.
 */
export interface CheckTrustedDeviceInput {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * The account of the sign-in.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property token
   *
   * @description
   * The value of `__Host-cw_trusted_device`. A secret, never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly token: string;
  // #endregion
}
