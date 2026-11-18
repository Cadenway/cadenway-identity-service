/**
 * Interface CheckTrustedDeviceOutput
 *
 * @description
 * Whether the browser is a trusted device of the account, whose sign-in then skips the challenge.
 */
export interface CheckTrustedDeviceOutput {
  // #region Properties
  /**
   * Property trusted
   *
   * @description
   * `false` for a token unknown, expired, forgotten, of another account or malformed.
   *
   * @type {boolean}
   * @readonly
   */
  readonly trusted: boolean;
  // #endregion
}
