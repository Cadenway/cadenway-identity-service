import type { EmailAddress } from '../../value-objects/email/email-address.value-object.js';

/**
 * Interface UserState
 *
 * @description
 * Everything an account holds, as the repository loads it.
 */
export interface UserState {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id assigned by PostgreSQL (`uuidv7()`) when the account was stored.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property email
   *
   * @description
   * The address of the account, verified or not.
   *
   * @type {EmailAddress}
   * @readonly
   */
  readonly email: EmailAddress;

  /**
   * Property name
   *
   * @description
   * Full name, trimmed.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property language
   *
   * @description
   * BCP 47 tag of the language of the account's emails.
   *
   * @type {string}
   * @readonly
   */
  readonly language: string;

  /**
   * Property emailVerifiedAt
   *
   * @description
   * When a code proved the address; `null` while the sign-up is not verified.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly emailVerifiedAt: Date | null;

  /**
   * Property version
   *
   * @description
   * Version of the account, 1 when created and incremented by each change.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;

  /**
   * Property signUpCount
   *
   * @description
   * Accepted sign-ups of the address for this account: 1 when created, incremented by each sign-up
   * that replaced its name and password before the verification. Above 1, the verification needs
   * the password of the latest sign-up.
   *
   * @type {number}
   * @readonly
   */
  readonly signUpCount: number;
  // #endregion
}
