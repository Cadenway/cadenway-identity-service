/**
 * Class DomainError
 *
 * @description
 * Base of the errors the sessions domain throws when a value or a transition would break one of
 * its rules. The application layer decides what each means for a caller.
 */
export abstract class DomainError extends Error {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Names the error after its class.
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
 * Class SessionEndedError
 *
 * @description
 * A change to a session that already ended: revoked, past its absolute expiry, or inactive too
 * long.
 */
export class SessionEndedError extends DomainError {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Refuses the change.
   *
   * @constructor
   */
  public constructor() {
    super('The session has already ended.');
  }
  // #endregion
}

/**
 * Class InvalidSessionStateError
 *
 * @description
 * A stored session whose state breaks an invariant: a defect of the data.
 */
export class InvalidSessionStateError extends DomainError {
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
    super(`The stored session breaks an invariant: ${invariant}.`);
  }
  // #endregion
}
