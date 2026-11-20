/** Deletes an expiration batch in its own system transaction. */
export interface ExpiredRealtimeTicketsUnitOfWork {
  // #region Methods
  /** Returns the number of expired, available rows deleted through the cutoff. */
  deleteBatch(cutoff: Date, limit: number): Promise<number>;
  // #endregion
}
