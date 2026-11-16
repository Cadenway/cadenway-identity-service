import { DomainError } from './domain.error.js';

/**
 * Class SignUpReplacedError
 *
 * @description
 * A verification with the right code that does not prove the latest sign-up of the address: its
 * password differs from the one of that sign-up, or it sends none although a later sign-up replaced
 * the name and password of the pending account (`auth.sign-up-replaced`).
 */
export class SignUpReplacedError extends DomainError {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Refuses the verification without quoting any password.
   *
   * @constructor
   */
  public constructor() {
    super('The verification does not prove the latest sign-up of the address.');
  }
  // #endregion
}
