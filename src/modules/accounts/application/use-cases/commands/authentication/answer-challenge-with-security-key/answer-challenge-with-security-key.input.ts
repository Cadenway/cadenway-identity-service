import type { SessionClient } from '../../../../models/sessions/session-client.model.js';

/**
 * Interface AnswerChallengeWithSecurityKeyInput
 *
 * @description
 * The answer of a two-step challenge with a security key (`SecurityKeyAnswer` of the contract).
 */
export interface AnswerChallengeWithSecurityKeyInput {
  // #region Properties
  /**
   * Property token
   *
   * @description
   * The token of the challenge. A secret, never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly token: string;

  /**
   * Property credential
   *
   * @description
   * `AuthenticationResponseJSON`, as the contract validated it.
   *
   * @type {Readonly<Record<string, unknown>>}
   * @readonly
   */
  readonly credential: Readonly<Record<string, unknown>>;

  /**
   * Property trustDevice
   *
   * @description
   * Whether the browser becomes a trusted device for 30 days.
   *
   * @type {boolean}
   * @readonly
   */
  readonly trustDevice: boolean;

  /**
   * Property client
   *
   * @description
   * The browser the session opens for.
   *
   * @type {SessionClient}
   * @readonly
   */
  readonly client: SessionClient;
  // #endregion
}
