/**
 * Interface IntrospectTokenInput
 *
 * @description
 * The value of a session cookie (`IntrospectionRequest` of the contract).
 */
export interface IntrospectTokenInput {
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
