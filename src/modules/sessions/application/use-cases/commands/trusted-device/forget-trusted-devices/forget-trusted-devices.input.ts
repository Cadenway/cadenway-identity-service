/**
 * Interface ForgetTrustedDevicesInput
 *
 * @description
 * The account whose trusted devices are forgotten: a password change or reset, turning two-step
 * verification off, the scheduling of the deletion.
 */
export interface ForgetTrustedDevicesInput {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * The account.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;
  // #endregion
}
