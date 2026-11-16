/**
 * Interface DiscoverSignInMethodsInput
 *
 * @description
 * The address of the sign-in screen (`SignInMethodsRequest` of the contract).
 */
export interface DiscoverSignInMethodsInput {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * The address, as typed; it does not change the answer.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;
  // #endregion
}
