/** Verified user and organization, with the session id obtained from introspection. */
export interface IssueRealtimeTicketInput {
  // #region Properties
  /** Verified account. */
  readonly actorUserId: string;

  /** Organization of the signed internal request. */
  readonly organizationId: string;

  /** Session verified by the gateway. */
  readonly sessionId: string;
  // #endregion
}
