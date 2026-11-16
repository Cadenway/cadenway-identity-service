/**
 * Interface CodeSentView
 *
 * @description
 * The answer of a request that sends a code (`CodeSent` of the contract), the same whether or not a
 * code was actually issued.
 */
export interface CodeSentView {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * The normalized address of the request.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property expiresAt
   *
   * @description
   * When a code sent now stops working.
   *
   * @type {Date}
   * @readonly
   */
  readonly expiresAt: Date;

  /**
   * Property resendAvailableAt
   *
   * @description
   * When another code can be asked for.
   *
   * @type {Date}
   * @readonly
   */
  readonly resendAvailableAt: Date;
  // #endregion
}
