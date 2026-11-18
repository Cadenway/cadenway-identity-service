/**
 * Interface SignInChallengeView
 *
 * @description
 * A two-step challenge as the `202` of the sign-ins and its inspection answer it (`SignInChallenge`
 * of the contract).
 */
export interface SignInChallengeView {
  // #region Properties
  /**
   * Property token
   *
   * @description
   * The token of the challenge. A secret, never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly token: string;

  /**
   * Property expiresAt
   *
   * @description
   * 10 minutes after the sign-in that issued it.
   *
   * @type {Date}
   * @readonly
   */
  readonly expiresAt: Date;

  /**
   * Property email
   *
   * @description
   * The address of the account.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property name
   *
   * @description
   * The full name of the account.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property methods
   *
   * @description
   * `authenticator-app`, then `security-key` with a key, then `backup-code` while one is left.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly methods: readonly string[];

  /**
   * Property securityKeyNames
   *
   * @description
   * The names of its keys, the oldest first.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly securityKeyNames: readonly string[];

  /**
   * Property backupCodesRemaining
   *
   * @description
   * Its unused backup codes.
   *
   * @type {number}
   * @readonly
   */
  readonly backupCodesRemaining: number;

  /**
   * Property lockedUntil
   *
   * @description
   * The end of the lockout of its two-step answers, `null` without one.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly lockedUntil: Date | null;
  // #endregion
}
