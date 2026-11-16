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
