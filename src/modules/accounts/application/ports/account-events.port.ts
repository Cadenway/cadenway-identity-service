import type { OneTimeCodePurpose } from '../../domain/one-time-code.js';
import type { User } from '../../domain/user.js';

/**
 * Interface IssuedCode
 *
 * @description
 * What the email of a new code needs: the code itself travels in the restricted event only.
 */
export interface IssuedCode {
  // #region Properties
  /**
   * Property codeId
   *
   * @description
   * Id of the stored code.
   *
   * @type {string}
   * @readonly
   */
  readonly codeId: string;

  /**
   * Property user
   *
   * @description
   * Account the code is for: its address, name and language address the email.
   *
   * @type {User}
   * @readonly
   */
  readonly user: User;

  /**
   * Property purpose
   *
   * @description
   * What the code proves, which decides the template of the email.
   *
   * @type {OneTimeCodePurpose}
   * @readonly
   */
  readonly purpose: OneTimeCodePurpose;

  /**
   * Property code
   *
   * @description
   * The 6 digits. A secret: never logged, never stored in clear by this service.
   *
   * @type {string}
   * @readonly
   */
  readonly code: string;

  /**
   * Property expiresAt
   *
   * @description
   * When the code stops working.
   *
   * @type {Date}
   * @readonly
   */
  readonly expiresAt: Date;
  // #endregion
}

/**
 * Interface AccountEvents
 *
 * @description
 * The events of the accounts module, appended to the outbox in the transaction of the unit of work
 * that changes the data: an event exists if and only if its change commits. None belongs to an
 * organization (`organizationId: null`).
 */
export interface AccountEvents {
  // #region Methods
  /**
   * Method userSignedUp
   *
   * @description
   * Appends `user.signed-up.v1` for an account created or signed up again, with its version.
   *
   * @param {User} user - The account after the sign-up.
   * @returns {Promise<void>} Resolves once appended.
   */
  userSignedUp(user: User): Promise<void>;

  /**
   * Method userEmailVerified
   *
   * @description
   * Appends `user.email-verified.v1` for an account whose address a code proved.
   *
   * @param {User} user - The account after the verification.
   * @returns {Promise<void>} Resolves once appended.
   */
  userEmailVerified(user: User): Promise<void>;

  /**
   * Method oneTimeCodeIssued
   *
   * @description
   * Appends the restricted `one-time-code.issued.v1`, published on `restricted.` for
   * notification-service only, which emails the code.
   *
   * @param {IssuedCode} issued - The code and its recipient.
   * @returns {Promise<void>} Resolves once appended.
   */
  oneTimeCodeIssued(issued: IssuedCode): Promise<void>;
  // #endregion
}
