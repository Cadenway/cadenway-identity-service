import type { SessionClient } from './session-client.model.js';

/**
 * Interface SessionRequest
 *
 * @description
 * The session a successful sign-in opens.
 */
export interface SessionRequest {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * Account the session signs in.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property persistent
   *
   * @description
   * Whether "Rester connecté pendant 30 jours" was ticked (`rememberMe`).
   *
   * @type {boolean}
   * @readonly
   */
  readonly persistent: boolean;

  /**
   * Property client
   *
   * @description
   * The browser of the session.
   *
   * @type {SessionClient}
   * @readonly
   */
  readonly client: SessionClient;
  // #endregion
}
