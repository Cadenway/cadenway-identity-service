import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import type { IssuedCode } from '../../../../models/authentication/issued-code.model.js';

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
   * Method userProfileUpdated
   *
   * @description
   * Appends `user.profile-updated.v1` for an account whose profile changed, with the whole profile
   * after the change and the members that moved.
   *
   * @param {User} user - The account after the change.
   * @param {readonly string[]} changed - The members that moved, one at least.
   * @returns {Promise<void>} Resolves once appended.
   */
  userProfileUpdated(user: User, changed: readonly string[]): Promise<void>;

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
