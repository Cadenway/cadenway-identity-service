import type { SessionClient } from '../../../../models/sessions/session-client.model.js';

/**
 * Interface ChangePasswordInput
 *
 * @description
 * A change of password from a session ("Modifier le mot de passe", `PUT /v1/me/password`).
 */
export interface ChangePasswordInput {
  // #region Properties
  /**
   * Property actorUserId
   *
   * @description
   * The person, from the verified internal token.
   *
   * @type {string}
   * @readonly
   */
  readonly actorUserId: string;

  /**
   * Property userId
   *
   * @description
   * The account of the path, which must be the actor.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property sessionId
   *
   * @description
   * The session of the request, which the right current password authenticates again.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;

  /**
   * Property currentPassword
   *
   * @description
   * The current password; never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly currentPassword: string;

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
   * Property client
   *
   * @description
   * The browser the password is changed in, shown in the e-mail.
   *
   * @type {SessionClient}
   * @readonly
   */
  readonly client: SessionClient;
  // #endregion
}
