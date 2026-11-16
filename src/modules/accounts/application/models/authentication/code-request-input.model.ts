/**
 * Interface CodeRequestInput
 *
 * @description
 * A request for a code (`CodeRequest` of the contract), the shape of the inputs of
 * `ResendSignUpCode` and `RequestSignInCode`.
 */
export interface CodeRequestInput {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * The address, as typed.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;
  // #endregion
}
