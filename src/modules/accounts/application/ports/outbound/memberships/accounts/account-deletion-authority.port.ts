/** Reserves a stable deletion attempt with the service that owns organization membership. */
export interface AccountDeletionAuthority {
  // #region Methods
  /** Returns owner only after a definitive ownership refusal. Other failures must be retried. */
  reserve(userId: string, attemptId: string): Promise<'reserved' | 'owner'>;
  // #endregion
}
