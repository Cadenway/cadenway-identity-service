/**
 * Interface EndRecentAuthenticationInput
 *
 * @description
 * The sessions of a person whose recent authentication a change or a reset of the password ends.
 */
export interface EndRecentAuthenticationInput {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * The person.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property exceptSessionId
   *
   * @description
   * The session that keeps its own (the one of a change), or `null` for none (a reset).
   *
   * @type {string | null}
   * @readonly
   */
  readonly exceptSessionId: string | null;

  /**
   * Property scope
   *
   * @description
   * Which windows end: `every-window` (a change or a reset of the password), or
   * `password-windows`, the windows opened by a password, which turning two-step verification on
   * ends in the other sessions.
   *
   * @type {'every-window' | 'password-windows'}
   * @readonly
   */
  readonly scope: 'every-window' | 'password-windows';
  // #endregion
}
