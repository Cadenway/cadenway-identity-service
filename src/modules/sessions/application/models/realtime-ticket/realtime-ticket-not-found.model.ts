/** An unknown, expired, consumed or unauthorized realtime ticket. */
export class RealtimeTicketNotFound extends Error {
  // #region Constructor
  /** Builds the same refusal without including credential or binding data. */
  public constructor() {
    super('The realtime ticket is unavailable.');
    this.name = 'RealtimeTicketNotFound';
  }
  // #endregion
}
