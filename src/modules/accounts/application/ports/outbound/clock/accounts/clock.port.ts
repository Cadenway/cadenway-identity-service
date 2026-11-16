/**
 * Interface Clock
 *
 * @description
 * Where the use cases of the accounts module read the time they hand to the domain.
 */
export interface Clock {
  // #region Methods
  /**
   * Method now
   *
   * @description
   * Returns the current instant.
   *
   * @returns {Date} The current instant.
   */
  now(): Date;
  // #endregion
}
