/**
 * Class DomainError
 *
 * @description
 * Base of the errors the accounts domain throws when a value or a transition would break one of
 * its rules. The application layer translates each into the stable code of the contract; a domain
 * error never reaches HTTP as it is.
 */
export abstract class DomainError extends Error {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Names the error after its class, so a log or a stack says which rule refused.
   *
   * @param {string} message - English description of the refused rule, without any value.
   * @constructor
   */
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
  // #endregion
}

/**
 * Class InvalidEmailAddressError
 *
 * @description
 * An address that is empty, longer than 254 characters or without `@` once trimmed. The contract
 * validates the format first, so this only guards the domain against a caller that skipped it.
 */
export class InvalidEmailAddressError extends DomainError {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Refuses the address without quoting it: an address is personal data.
   *
   * @constructor
   */
  public constructor() {
    super('The email address is not a valid address.');
  }
  // #endregion
}

/**
 * Class InvalidUserNameError
 *
 * @description
 * A full name that is empty once its surrounding spaces are removed, or longer than 120 characters.
 */
export class InvalidUserNameError extends DomainError {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Refuses the name without quoting it.
   *
   * @constructor
   */
  public constructor() {
    super('The name must have 1 to 120 characters once trimmed.');
  }
  // #endregion
}

/**
 * Class InvalidUserStateError
 *
 * @description
 * A stored account whose state breaks an invariant (a version below 1, an unknown language): a
 * defect of the data, never an answer to a caller.
 */
export class InvalidUserStateError extends DomainError {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Names the broken invariant.
   *
   * @param {string} invariant - Which invariant the stored state breaks.
   * @constructor
   */
  public constructor(invariant: string) {
    super(`The stored account breaks an invariant: ${invariant}.`);
  }
  // #endregion
}

/**
 * Class EmailAlreadyVerifiedError
 *
 * @description
 * A change that only an account whose address is not verified yet accepts: replacing the name and
 * password of a sign-up, or verifying the address.
 */
export class EmailAlreadyVerifiedError extends DomainError {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Refuses the change of a verified account.
   *
   * @constructor
   */
  public constructor() {
    super('The address of this account is already verified.');
  }
  // #endregion
}

/**
 * Class PasswordTooShortError
 *
 * @description
 * A password with fewer Unicode code points than the policy requires.
 */
export class PasswordTooShortError extends DomainError {
  // #region Properties
  /**
   * Property minLength
   *
   * @description
   * The minimum length of the policy, in code points, for `details.minLength`.
   *
   * @type {number}
   * @readonly
   */
  public readonly minLength: number;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Refuses the password without quoting it or its length.
   *
   * @param {number} minLength - The minimum length of the policy.
   * @constructor
   */
  public constructor(minLength: number) {
    super(`A password needs ${String(minLength)} characters at least.`);
    this.minLength = minLength;
  }
  // #endregion
}

/**
 * Class CodeThrottledError
 *
 * @description
 * A code request for an address and a purpose less than 30 seconds after the previous one.
 */
export class CodeThrottledError extends DomainError {
  // #region Properties
  /**
   * Property resendAvailableAt
   *
   * @description
   * When the next request for the same address and purpose is accepted.
   *
   * @type {Date}
   * @readonly
   */
  public readonly resendAvailableAt: Date;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Refuses the request until `resendAvailableAt`.
   *
   * @param {Date} resendAvailableAt - When the next request is accepted.
   * @constructor
   */
  public constructor(resendAvailableAt: Date) {
    super('A code was requested for this address less than 30 seconds ago.');
    this.resendAvailableAt = resendAvailableAt;
  }
  // #endregion
}

/**
 * Class AccountLockedError
 *
 * @description
 * A password sign-in of an address whose lockout has not ended, whatever the password.
 */
export class AccountLockedError extends DomainError {
  // #region Properties
  /**
   * Property lockedUntil
   *
   * @description
   * When the password sign-in of the address is accepted again.
   *
   * @type {Date}
   * @readonly
   */
  public readonly lockedUntil: Date;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Refuses the sign-in until `lockedUntil`.
   *
   * @param {Date} lockedUntil - When the lockout ends.
   * @constructor
   */
  public constructor(lockedUntil: Date) {
    super('The password sign-in of this address is locked.');
    this.lockedUntil = lockedUntil;
  }
  // #endregion
}

/**
 * Class InvalidOneTimeCodeStateError
 *
 * @description
 * A stored code whose counters break an invariant, or a change to a code that no longer works.
 */
export class InvalidOneTimeCodeStateError extends DomainError {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Names the broken invariant, never the code.
   *
   * @param {string} invariant - Which invariant is broken.
   * @constructor
   */
  public constructor(invariant: string) {
    super(`The one-time code breaks an invariant: ${invariant}.`);
  }
  // #endregion
}
