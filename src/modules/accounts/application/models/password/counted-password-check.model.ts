import type { PasswordFailure } from '../../../domain/policies/password/password-failure.policy.js';
import type { EmailAddress } from '../../../domain/value-objects/email/email-address.value-object.js';

/**
 * Interface CountedPasswordCheck
 *
 * @description
 * A check of the current password of a signed-in person, counted as a failure in advance, with
 * what its check outside the transaction needs.
 */
export interface CountedPasswordCheck {
  // #region Properties
  /**
   * Property failure
   *
   * @description
   * The answer if the password turns out wrong.
   *
   * @type {PasswordFailure}
   * @readonly
   */
  readonly failure: PasswordFailure;

  /**
   * Property email
   *
   * @description
   * The address of the account, the key of its lockout.
   *
   * @type {EmailAddress}
   * @readonly
   */
  readonly email: EmailAddress;

  /**
   * Property passwordHash
   *
   * @description
   * The stored hash, or `null`.
   *
   * @type {string | null}
   * @readonly
   */
  readonly passwordHash: string | null;
  // #endregion
}
