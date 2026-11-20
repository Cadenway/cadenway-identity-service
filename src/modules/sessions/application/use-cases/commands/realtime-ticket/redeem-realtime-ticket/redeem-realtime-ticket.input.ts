/** Ticket presented by the authorized realtime gateway. */
export interface RedeemRealtimeTicketInput {
  // #region Properties
  /** Opaque credential, never persisted or logged. */
  readonly token: string;
  // #endregion
}
