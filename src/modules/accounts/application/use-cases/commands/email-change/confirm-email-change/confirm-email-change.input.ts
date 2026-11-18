import type { SessionClient } from '../../../../models/sessions/session-client.model.js';

/**
 * Interface ConfirmEmailChangeInput
 *
 * @description
 * The code sent to the new address, typed in the session that asked for the change ("Confirmer
 * l’adresse").
 */
export interface ConfirmEmailChangeInput {
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
   * The session of the request, which must be the one that asked for the change.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;

  /**
   * Property code
   *
   * @description
   * The 6 digits; never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly code: string;

  /**
   * Property client
   *
   * @description
   * The browser the address is confirmed in, shown in the notice to the previous address.
   *
   * @type {SessionClient}
   * @readonly
   */
  readonly client: SessionClient;
  // #endregion
}
