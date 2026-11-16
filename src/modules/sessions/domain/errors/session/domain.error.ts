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
