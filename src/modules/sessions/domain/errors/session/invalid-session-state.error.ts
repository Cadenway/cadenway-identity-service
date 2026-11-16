import { DomainError } from './domain.error.js';

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
