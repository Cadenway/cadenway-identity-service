import type { SessionClient } from '../../../../models/sessions/session-client.model.js';

/**
 * Interface AddSecurityKeyInput
 *
 * @description
 * The answer of a browser to the registration options of a key, and its name.
 */
export interface AddSecurityKeyInput {
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
   * The session of the public request, whose pending registration is answered.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;

  /**
   * Property name
   *
   * @description
   * The name of the key, as typed.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property credential
   *
   * @description
   * `RegistrationResponseJSON`, as the contract validated it.
   *
   * @type {Readonly<Record<string, unknown>>}
   * @readonly
   */
  readonly credential: Readonly<Record<string, unknown>>;

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
