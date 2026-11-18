/**
 * Interface InspectSignInChallengeInput
 *
 * @description
 * A reading of a two-step challenge, without answering it.
 */
export interface InspectSignInChallengeInput {
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
