/**
 * Interface ConfirmPasswordResetOutput
 *
 * @description
 * The outcome of a reset ("Vos 3 autres sessions ont été fermées." or "Vos autres sessions restent
 * ouvertes."); nobody is signed in.
 */
export interface ConfirmPasswordResetOutput {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * Address of the account, where the confirmation e-mail goes.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property closedSessionCount
   *
   * @description
   * Sessions the reset closed.
   *
   * @type {number}
   * @readonly
   */
  readonly closedSessionCount: number;
  // #endregion
}
