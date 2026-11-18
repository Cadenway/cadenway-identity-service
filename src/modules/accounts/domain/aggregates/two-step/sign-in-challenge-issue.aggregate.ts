/**
 * Interface SignInChallengeIssue
 *
 * @description
 * A new two-step challenge of an account, before it is stored with its id (PostgreSQL assigns it).
 */
export interface SignInChallengeIssue {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * The account whose first factor was right.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property tokenHash
   *
   * @description
   * The SHA-256 of the token of the challenge; the token itself is never stored.
   *
   * @type {string}
   * @readonly
   */
  readonly tokenHash: string;

  /**
   * Property persistent
   *
   * @description
   * The `rememberMe` of the sign-in, for the session its answer opens.
   *
   * @type {boolean}
   * @readonly
   */
  readonly persistent: boolean;

  /**
   * Property expiresAt
   *
   * @description
   * 10 minutes after the sign-in.
   *
   * @type {Date}
   * @readonly
   */
  readonly expiresAt: Date;
  // #endregion
}
