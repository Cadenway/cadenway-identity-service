import type { SessionClient } from '../../../../models/sessions/session-client.model.js';

/**
 * Interface ConfirmPasswordResetInput
 *
 * @description
 * A new password chosen with a reset link ("Enregistrer le mot de passe").
 */
export interface ConfirmPasswordResetInput {
  // #region Properties
  /**
   * Property token
   *
   * @description
   * The token of the link; never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly token: string;

  /**
   * Property newPassword
   *
   * @description
   * The new password; never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly newPassword: string;

  /**
   * Property closeOtherSessions
   *
   * @description
   * "Fermer mes autres sessions", ticked by default: revokes every open session of the account.
   *
   * @type {boolean}
   * @readonly
   */
  readonly closeOtherSessions: boolean;

  /**
   * Property client
   *
   * @description
   * The browser the new password is chosen in, shown in the e-mail.
   *
   * @type {SessionClient}
   * @readonly
   */
  readonly client: SessionClient;
  // #endregion
}
