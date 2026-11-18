import { DomainError } from '../accounts/domain.error.js';

/**
 * Class DeletionAlreadyScheduledError
 *
 * @description
 * A second scheduling of the deletion of an account whose deletion is already scheduled. It cannot
 * be reached through the routes: the scheduling revokes every session, and the sign-in that opens
 * the next one cancels the deletion (`POST /v1/me/deletion`).
 */
export class DeletionAlreadyScheduledError extends DomainError {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Refuses the second scheduling.
   *
   * @constructor
   */
  public constructor() {
    super('The deletion of this account is already scheduled.');
  }
  // #endregion
}
