import { DomainError } from './domain.error.js';

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
