import { DomainError } from './domain.error.js';

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
