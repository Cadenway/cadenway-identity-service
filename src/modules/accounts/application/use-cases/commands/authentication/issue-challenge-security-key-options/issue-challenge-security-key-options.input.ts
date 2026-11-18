/**
 * Interface IssueChallengeSecurityKeyOptionsInput
 *
 * @description
 * A request of the WebAuthn options of a two-step challenge.
 */
export interface IssueChallengeSecurityKeyOptionsInput {
  // #region Properties
  /**
   * Property token
   *
   * @description
   * The token of the challenge. A secret, never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly token: string;
  // #endregion
}
