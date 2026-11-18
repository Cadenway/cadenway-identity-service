/**
 * Interface IssuedChallengeToken
 *
 * @description
 * The token of a new two-step challenge and its hash: the token leaves once, in the `202`, the hash
 * is stored.
 */
export interface IssuedChallengeToken {
  // #region Properties
  /**
   * Property token
   *
   * @description
   * 256 random bits in base64url. A secret, never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly token: string;

  /**
   * Property tokenHash
   *
   * @description
   * Its SHA-256, hex.
   *
   * @type {string}
   * @readonly
   */
  readonly tokenHash: string;
  // #endregion
}
