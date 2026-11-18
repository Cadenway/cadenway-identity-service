import { DomainError } from '../accounts/domain.error.js';

/**
 * Class TwoStepLockedError
 *
 * @description
 * A two-step answer of an account whose lockout has not ended, whatever the answer: five wrong
 * answers in a row lock the two-step answers of the account for 15 minutes (decision 7 of P2c,
 * `429 auth.two-step-locked` of the contract).
 */
export class TwoStepLockedError extends DomainError {
  // #region Properties
  /**
   * Property lockedUntil
   *
   * @description
   * When the two-step answers of the account are accepted again.
   *
   * @type {Date}
   * @readonly
   */
  public readonly lockedUntil: Date;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Refuses the answer until `lockedUntil`.
   *
   * @param {Date} lockedUntil - When the lockout ends.
   * @constructor
   */
  public constructor(lockedUntil: Date) {
    super('The two-step answers of this account are locked.');
    this.lockedUntil = lockedUntil;
  }
  // #endregion
}
