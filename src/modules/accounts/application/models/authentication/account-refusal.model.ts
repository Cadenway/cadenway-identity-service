import type { Refusal } from './refusal.model.js';

/**
 * Class AccountRefusal
 *
 * @description
 * Thrown by a use case of the accounts module for an expected refusal of the contract. Its message
 * names the reason only: no address, password or code.
 */
export class AccountRefusal extends Error {
  // #region Properties
  /**
   * Property refusal
   *
   * @description
   * The reason and its details.
   *
   * @type {Refusal}
   * @readonly
   */
  public readonly refusal: Refusal;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Builds the refusal.
   *
   * @param {Refusal} refusal - The reason and its details.
   * @constructor
   */
  public constructor(refusal: Refusal) {
    super(`The request was refused: ${refusal.reason}.`);
    this.name = 'AccountRefusal';
    this.refusal = refusal;
  }
  // #endregion
}
