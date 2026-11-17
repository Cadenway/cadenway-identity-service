import { DomainError } from './domain.error.js';

/**
 * Class MembershipMismatchError
 *
 * @description
 * An event of a membership that names another organization or another account than the copy holds:
 * a membership never moves, so the event is a defect, never applied.
 */
export class MembershipMismatchError extends DomainError {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Refuses the event without quoting its ids.
   *
   * @constructor
   */
  public constructor() {
    super('The event names another organization or account than its membership.');
  }
  // #endregion
}
