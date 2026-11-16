import type { OneTimeCodePurpose } from '../../value-objects/one-time-code-purpose/one-time-code-purpose.value-object.js';

/**
 * Interface OneTimeCodeState
 *
 * @description
 * A stored code. The code itself is never stored: only its keyed hash.
 */
export interface OneTimeCodeState {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id assigned by PostgreSQL, the `codeId` of the event.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

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
   * Property codeHash
   *
   * @description
   * Keyed hash of the code, as hexadecimal; comparing two hashes compares two codes.
   *
   * @type {string}
   * @readonly
   */
  readonly codeHash: string;

  /**
   * Property expiresAt
   *
   * @description
   * When the code stops working.
   *
   * @type {Date}
   * @readonly
   */
  readonly expiresAt: Date;

  /**
   * Property failedAttempts
   *
   * @description
   * Wrong codes checked against this one, from 0 to `MAX_FAILED_ATTEMPTS`.
   *
   * @type {number}
   * @readonly
   */
  readonly failedAttempts: number;

  /**
   * Property consumedAt
   *
   * @description
   * When the code was accepted; a code works once.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly consumedAt: Date | null;

  /**
   * Property replacedAt
   *
   * @description
   * When a newer code of the same account and purpose replaced it.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly replacedAt: Date | null;
  // #endregion
}
