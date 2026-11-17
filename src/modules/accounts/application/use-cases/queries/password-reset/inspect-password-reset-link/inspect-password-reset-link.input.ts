/**
 * Interface InspectPasswordResetLinkInput
 *
 * @description
 * The token of a reset link, read from the fragment of the link by the web application.
 */
export interface InspectPasswordResetLinkInput {
  // #region Properties
  /**
   * Property token
   *
   * @description
   * The token; never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly token: string;
  // #endregion
}
