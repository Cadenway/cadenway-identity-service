/**
 * Class SystemClock
 *
 * @description
 * The clock of the process, bound by each business module to its own `Clock` port. The domain
 * never reads time itself: the use cases read it here and pass it in, so the specs drive time with
 * a fixed clock instead.
 */
export class SystemClock {
  // #region Methods
  /**
   * Method now
   *
   * @description
   * Returns the current instant of the system clock.
   *
   * @returns {Date} A new date for the current instant.
   */
  public now(): Date {
    return new Date();
  }
  // #endregion
}
