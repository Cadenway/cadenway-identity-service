import type { RealtimeTicketAccess } from '../../../../models/realtime-ticket/realtime-ticket-access.model.js';

/** Authorizes a session's membership and policy in its caller's system transaction. */
export interface RealtimeTicketAccessPort {
  // #region Methods
  /**
   * Locks the relevant active membership, policy and enrollment until transaction completion,
   * then checks the same MFA rule used by session introspection.
   */
  resolveForUpdate(organizationId: string, userId: string): Promise<RealtimeTicketAccess>;
  // #endregion
}
