import type { SessionClient } from '../../../../models/sessions/session-client.model.js';

/**
 * Interface AnswerChallengeWithBackupCodeInput
 *
 * @description
 * The answer of a two-step challenge with a backup code (`BackupCodeAnswer` of the contract).
 */
export interface AnswerChallengeWithBackupCodeInput {
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
   * The backup code, with or without its dash, in any case. A secret, never logged.
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
