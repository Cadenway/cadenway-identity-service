import { DomainError } from './domain.error.js';

/**
 * Class InvalidApiTokenError
 *
 * @description
 * A token that would break an invariant: a name empty once trimmed or longer than 100 characters,
 * no scope or an unknown one, a prefix that is not the start of a secret, or a stored state with a
 * version that is not a positive integer. The HTTP schema refuses the first ones before the use
 * case, so here it is a defect.
 */
export class InvalidApiTokenError extends DomainError {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Names the broken invariant, without quoting a value.
   *
   * @param {string} invariant - Which invariant the token breaks.
   * @constructor
   */
  public constructor(invariant: string) {
    super(`The API token breaks an invariant: ${invariant}.`);
  }
  // #endregion
}
