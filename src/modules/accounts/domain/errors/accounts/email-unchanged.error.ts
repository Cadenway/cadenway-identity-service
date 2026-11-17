import { DomainError } from './domain.error.js';

/**
 * Class EmailUnchangedError
 *
 * @description
 * A change of address to the current address of the account ("C’est déjà votre adresse actuelle :
 * saisissez la nouvelle.", `422 auth.email-unchanged` of `POST /v1/me/email-change`).
 */
export class EmailUnchangedError extends DomainError {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Refuses the change to the current address.
   *
   * @constructor
   */
  public constructor() {
    super('The new address is the current address of the account.');
  }
  // #endregion
}
