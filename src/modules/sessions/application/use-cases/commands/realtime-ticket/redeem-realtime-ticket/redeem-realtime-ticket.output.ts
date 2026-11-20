/** Current session identity, returned only after the ticket is consumed. */
export interface RedeemRealtimeTicketOutput {
  // #region Properties
  /** Session identifier. */
  readonly sessionId: string;
  readonly sessionVersion: number;
  readonly userId: string;
  readonly organizationId: string;
  readonly memberId: string;
  readonly role: 'owner' | 'admin' | 'member' | 'guest';
  readonly sessionExpiresAt: Date;
  // #endregion
}
