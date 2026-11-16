/**
 * Interface PasswordLockoutState
 *
 * @description
 * The failed password sign-ins of one address, whether or not an account uses it.
 */
export interface PasswordLockoutState {
  // #region Properties
  /**
   * Property failedAttempts
   *
   * @description
   * Consecutive failed password sign-ins since the last success or the end of the last lockout.
   *
   * @type {number}
   * @readonly
   */
  readonly failedAttempts: number;

  /**
   * Property lockedUntil
   *
   * @description
   * When the current or last lockout ends; `null` when the address was never locked since the last
   * success.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly lockedUntil: Date | null;
  // #endregion
}
