import type { SessionClient } from '../../../../models/sessions/session-client.model.js';

/**
 * Interface AnswerChallengeWithAuthenticatorAppInput
 *
 * @description
 * The answer of a two-step challenge with a code of the app (`AuthenticatorAppAnswer` of the
 * contract).
 */
export interface AnswerChallengeWithAuthenticatorAppInput {
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
   * Property code
   *
   * @description
   * The 6 digits of the app. A secret, never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly code: string;

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
