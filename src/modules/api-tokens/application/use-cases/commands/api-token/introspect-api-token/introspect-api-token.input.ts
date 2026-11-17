/**
 * Interface IntrospectApiTokenInput
 *
 * @description
 * The value of a bearer token (`ApiTokenIntrospectionRequest` of the contract).
 */
export interface IntrospectApiTokenInput {
  // #region Properties
  /**
   * Property token
   *
   * @description
   * The token; a secret, never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly token: string;
  // #endregion
}
