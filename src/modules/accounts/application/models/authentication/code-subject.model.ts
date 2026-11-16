import type { OneTimeCodePurpose } from '../../../domain/value-objects/one-time-code-purpose/one-time-code-purpose.value-object.js';

/**
 * Interface CodeSubject
 *
 * @description
 * What a code hash binds: the same digits for another account or purpose hash differently.
 */
export interface CodeSubject {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * Account the code is for.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property purpose
   *
   * @description
   * What the code proves.
   *
   * @type {OneTimeCodePurpose}
   * @readonly
   */
  readonly purpose: OneTimeCodePurpose;

  /**
   * Property code
   *
   * @description
   * The 6 digits, issued or typed.
   *
   * @type {string}
   * @readonly
   */
  readonly code: string;
  // #endregion
}
