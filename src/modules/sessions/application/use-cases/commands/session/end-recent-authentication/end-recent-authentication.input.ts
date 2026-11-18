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
  // #endregion
}
