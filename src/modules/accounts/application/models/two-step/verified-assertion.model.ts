/**
 * Interface VerifiedAssertion
 *
 * @description
 * An answer of a security key to a challenge that verified.
 */
export interface VerifiedAssertion {
  // #region Properties
  /**
   * Property newCounter
   *
   * @description
   * The signature counter the key reported, stored for the next answer.
   *
   * @type {number}
   * @readonly
   */
  readonly newCounter: number;
  // #endregion
}
