/** Removes rows that no longer serve an authentication throttle. */
export interface InactiveAuthenticationCountersUnitOfWork {
  // #region Methods
  /** Deletes at most the limit from each counter table and returns the total removed. */
  deleteBatch(limit: number): Promise<number>;
  // #endregion
}
