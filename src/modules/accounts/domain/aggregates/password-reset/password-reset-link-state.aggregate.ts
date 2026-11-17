/**
 * Interface PasswordResetLinkState
 *
 * @description
 * Everything a password reset link holds, as the repository loads it. The token itself is never
 * stored: only its SHA-256 hash.
 */
export interface PasswordResetLinkState {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id assigned by PostgreSQL (`uuidv7()`), the `linkId` of `password-reset-link.issued.v1`.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property userId
   *
   * @description
   * The account the link resets.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property tokenHash
   *
   * @description
   * SHA-256 of the token, in hexadecimal.
   *
   * @type {string}
   * @readonly
   */
  readonly tokenHash: string;

  /**
   * Property expiresAt
   *
   * @description
   * When the link stops working, 30 minutes after it was issued.
   *
   * @type {Date}
   * @readonly
   */
  readonly expiresAt: Date;

  /**
   * Property usedAt
   *
   * @description
   * When a new password was set with it, or `null`.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly usedAt: Date | null;

  /**
   * Property replacedAt
   *
   * @description
   * When a newer link of the account, or a change of address, made it stop working, or `null`.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly replacedAt: Date | null;
  // #endregion
}
