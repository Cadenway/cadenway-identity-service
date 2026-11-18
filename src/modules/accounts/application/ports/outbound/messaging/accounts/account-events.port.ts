import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import type { EmailAddress } from '../../../../../domain/value-objects/email/email-address.value-object.js';
import type { IssuedCode } from '../../../../models/authentication/issued-code.model.js';
import type { IssuedResetLink } from '../../../../models/password-reset/issued-reset-link.model.js';
import type { ClientDescription } from '../../../../models/sessions/client-description.model.js';

/**
 * Interface AccountEvents
 *
 * @description
 * The events of the accounts module, appended to the outbox in the transaction of the use case
 * (`asyncapi/identity-service.yaml`). `one-time-code.issued.v1` and `password-reset-link.issued.v1`
 * are restricted: they carry a secret and are published on `restricted.` only.
 */
export interface AccountEvents {
  // #region Methods
  /**
   * Method userSignedUp
   *
   * @description
   * Appends `user.signed-up.v1`.
   *
   * @param {User} user - The account after the sign-up.
   * @returns {Promise<void>} Resolves once appended.
   */
  userSignedUp(user: User): Promise<void>;

  /**
   * Method userEmailVerified
   *
   * @description
   * Appends `user.email-verified.v1`.
   *
   * @param {User} user - The verified account.
   * @returns {Promise<void>} Resolves once appended.
   */
  userEmailVerified(user: User): Promise<void>;

  /**
   * Method userProfileUpdated
   *
   * @description
   * Appends `user.profile-updated.v1`.
   *
   * @param {User} user - The account after the change.
   * @param {readonly string[]} changed - The members that moved.
   * @returns {Promise<void>} Resolves once appended.
   */
  userProfileUpdated(user: User, changed: readonly string[]): Promise<void>;

  /**
   * Method oneTimeCodeIssued
   *
   * @description
   * Appends the restricted `one-time-code.issued.v1`.
   *
   * @param {IssuedCode} issued - The code and its recipient.
   * @returns {Promise<void>} Resolves once appended.
   */
  oneTimeCodeIssued(issued: IssuedCode): Promise<void>;

  /**
   * Method passwordResetLinkIssued
   *
   * @description
   * Appends the restricted `password-reset-link.issued.v1`.
   *
   * @param {IssuedResetLink} issued - The link and its recipient.
   * @returns {Promise<void>} Resolves once appended.
   */
  passwordResetLinkIssued(issued: IssuedResetLink): Promise<void>;

  /**
   * Method userPasswordChanged
   *
   * @description
   * Appends `user.password-changed.v1`.
   *
   * @param {User} user - The account after the change.
   * @param {'change' | 'reset'} method - From a session, or with a reset link.
   * @param {number} closedSessionCount - The sessions the change closed.
   * @param {ClientDescription} client - The browser the password was set in.
   * @returns {Promise<void>} Resolves once appended.
   */
  userPasswordChanged(
    user: User,
    method: 'change' | 'reset',
    closedSessionCount: number,
    client: ClientDescription,
  ): Promise<void>;

  /**
   * Method userEmailChanged
   *
   * @description
   * Appends `user.email-changed.v1`.
   *
   * @param {User} user - The account with its new address.
   * @param {EmailAddress} previousEmail - The address before the change.
   * @param {ClientDescription} client - The browser the address was confirmed in.
   * @returns {Promise<void>} Resolves once appended.
   */
  userEmailChanged(
    user: User,
    previousEmail: EmailAddress,
    client: ClientDescription,
  ): Promise<void>;

  /**
   * Method userDeletionScheduled
   *
   * @description
   * Appends `user.deletion-scheduled.v1`.
   *
   * @param {User} user - The account, its deletion scheduled.
   * @returns {Promise<void>} Resolves once appended.
   */
  userDeletionScheduled(user: User): Promise<void>;

  /**
   * Method userDeletionCancelled
   *
   * @description
   * Appends `user.deletion-cancelled.v1`.
   *
   * @param {User} user - The account, its deletion cancelled.
   * @param {string} sessionId - The session the sign-in opened.
   * @param {ClientDescription} client - The browser that signed in.
   * @returns {Promise<void>} Resolves once appended.
   */
  userDeletionCancelled(user: User, sessionId: string, client: ClientDescription): Promise<void>;

  /**
   * Method userDeleted
   *
   * @description
   * Appends `user.deleted.v1`, the last event of the account, credited to identity-service.
   *
   * @param {string} userId - The deleted account.
   * @param {number} version - The version of the account after the deletion.
   * @returns {Promise<void>} Resolves once appended.
   */
  userDeleted(userId: string, version: number): Promise<void>;
  // #endregion
}
