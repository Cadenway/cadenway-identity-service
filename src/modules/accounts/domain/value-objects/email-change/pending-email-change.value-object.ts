import type { EmailAddress } from '../email/email-address.value-object.js';

/**
 * Interface PendingEmailChange
 *
 * @description
 * A change of address asked from a session and not confirmed yet (`POST /v1/me/email-change`). It
 * belongs to the session that asked: only that session confirms it with the code sent to the new
 * address; the end of that session, a newer request and a change or a reset of the password drop
 * it. The current address stays the address of the account until the confirmation ("L'adresse
 * actuelle reste active jusqu'à la confirmation.").
 */
export interface PendingEmailChange {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * The account whose address changes.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property sessionId
   *
   * @description
   * The session that asked for the change.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;

  /**
   * Property email
   *
   * @description
   * The new address, normalized.
   *
   * @type {EmailAddress}
   * @readonly
   */
  readonly email: EmailAddress;
  // #endregion
}
