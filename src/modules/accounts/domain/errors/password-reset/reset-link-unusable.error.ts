import { DomainError } from '../accounts/domain.error.js';

/**
 * Class ResetLinkUnusableError
 *
 * @description
 * A password reset link that expired, was used or was replaced by a newer one ("Ce lien a expiré",
 * `422 auth.reset-link-expired` of `openapi/public/auth.yaml`).
 */
export class ResetLinkUnusableError extends DomainError {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Refuses the use of the link.
   *
   * @constructor
   */
  public constructor() {
    super('The password reset link is no longer usable.');
  }
  // #endregion
}
