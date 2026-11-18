/**
 * Interface TrustDeviceInput
 *
 * @description
 * The account whose browser becomes a trusted device, by the answer of a challenge with
 * `trustDevice`.
 */
export interface TrustDeviceInput {
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
