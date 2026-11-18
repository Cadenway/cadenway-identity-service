import type { SessionClient } from '../../../../models/sessions/session-client.model.js';

/**
 * Interface ConfirmAuthenticatorAppSetupInput
 *
 * @description
 * The confirmation of an authenticator app with one of its codes.
 */
export interface ConfirmAuthenticatorAppSetupInput {
  // #region Properties
  /**
   * Property actorUserId
   *
   * @description
   * The actor, from the verified internal token.
   *
   * @type {string}
   * @readonly
   */
  readonly actorUserId: string;

  /**
   * Property userId
   *
   * @description
   * The account of the path.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property sessionId
   *
   * @description
   * The session of the public request, whose pending setup is confirmed.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;

  /**
   * Property code
   *
   * @description
   * The 6 digits the new app shows. A secret, never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly code: string;

  /**
   * Property client
   *
   * @description
   * The browser of the change, shown in the security e-mail.
   *
   * @type {SessionClient}
   * @readonly
   */
  readonly client: SessionClient;
  // #endregion
}
