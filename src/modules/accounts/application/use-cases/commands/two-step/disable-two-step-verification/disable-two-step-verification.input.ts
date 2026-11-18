import type { SessionClient } from '../../../../models/sessions/session-client.model.js';

/**
 * Interface DisableTwoStepVerificationInput
 *
 * @description
 * Turning the two-step verification of the account off.
 */
export interface DisableTwoStepVerificationInput {
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
   * The session of the public request, whose recent authentication is checked.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;

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
