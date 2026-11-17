import type { SessionClient } from '../../../../models/sessions/session-client.model.js';

/**
 * Interface RequestPasswordResetInput
 *
 * @description
 * A request of a password reset link ("Mot de passe oublié", `POST /v1/auth/password-reset`).
 */
export interface RequestPasswordResetInput {
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

  /**
   * Property client
   *
   * @description
   * The browser that asks, shown in the e-mail.
   *
   * @type {SessionClient}
   * @readonly
   */
  readonly client: SessionClient;
  // #endregion
}
