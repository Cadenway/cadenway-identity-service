/**
 * Interface CheckedAuthentication
 *
 * @description
 * What a guarded route learns of the session of its request: whether its window of recent
 * authentication counts, and whether the account has two-step verification, which gives the
 * methods of a refusal (`[password]` or `[authenticator-app]`).
 */
export interface CheckedAuthentication {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * `recent` inside a window that counts for the account, `stale` for an open session without
   * one, `not-found` when it is not an open session of the person.
   *
   * @type {'recent' | 'stale' | 'not-found'}
   * @readonly
   */
  readonly status: 'recent' | 'stale' | 'not-found';

  /**
   * Property twoStepVerificationEnabled
   *
   * @description
   * Whether the account has two-step verification.
   *
   * @type {boolean}
   * @readonly
   */
  readonly twoStepVerificationEnabled: boolean;
  // #endregion
}
