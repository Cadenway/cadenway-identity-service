import { DomainError } from '../accounts/domain.error.js';

/**
 * Class CodeThrottledError
 *
 * @description
 * A code request of an address, whatever its purpose, less than 30 seconds after the last accepted
 * one, or once 5 were accepted in the current hour.
 */
export class CodeThrottledError extends DomainError {
  // #region Properties
  /**
   * Property resendAvailableAt
   *
   * @description
   * When the next request of the address is accepted.
   *
   * @type {Date}
   * @readonly
   */
  public readonly resendAvailableAt: Date;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Refuses the request until `resendAvailableAt`.
   *
   * @param {Date} resendAvailableAt - When the next request is accepted.
   * @constructor
   */
  public constructor(resendAvailableAt: Date) {
    super('A code was requested for this address too recently or too often.');
    this.resendAvailableAt = resendAvailableAt;
  }
  // #endregion
}
