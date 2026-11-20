/** Credential returned once, after its digest has committed. */
export interface IssueRealtimeTicketOutput {
  // #region Properties
  /** Opaque single-use credential. */
  readonly token: string;

  /** Exclusive expiration of the credential. */
  readonly expiresAt: Date;
  // #endregion
}
