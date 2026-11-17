import type { User } from '../../../domain/aggregates/account/user.aggregate.js';
import type { EmailAddress } from '../../../domain/value-objects/email/email-address.value-object.js';
import type { OneTimeCodePurpose } from '../../../domain/value-objects/one-time-code-purpose/one-time-code-purpose.value-object.js';

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

  /**
   * Property recipient
   *
   * @description
   * Address the email goes to: the address of the account, or the new address of a change of
   * address (`email-change`).
   *
   * @type {EmailAddress}
   * @readonly
   */
  readonly recipient: EmailAddress;

  /**
   * Property requestedByUser
   *
   * @description
   * Whether a signed-in person asked for the code (`email-change`): the event then credits the
   * user, otherwise identity-service (`one-time-code.issued.v1`).
   *
   * @type {boolean}
   * @readonly
   */
  readonly requestedByUser: boolean;
  // #endregion
}
