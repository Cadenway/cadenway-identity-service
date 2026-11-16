import { DomainError } from '../accounts/domain.error.js';

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
