import { DomainError } from './domain.error.js';

/**
 * Class InvalidMembershipStateError
 *
 * @description
 * A stored membership, or an event, whose version breaks an invariant: a defect of the data.
 */
export class InvalidMembershipStateError extends DomainError {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Names the broken invariant.
   *
   * @param {string} invariant - Which invariant the state breaks.
   * @constructor
   */
  public constructor(invariant: string) {
    super(`The membership breaks an invariant: ${invariant}.`);
  }
  // #endregion
}
