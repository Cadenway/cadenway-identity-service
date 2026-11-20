/** Stored ticket state. The transport credential is represented only by its digest. */
export interface RealtimeTicketState {
  // #region Properties
  /** Lowercase hexadecimal SHA-256 digest used for the ticket lookup. */
  readonly tokenHash: string;

  /** Session to revalidate before redeeming the ticket. */
  readonly sessionId: string;

  /** Account that owns the bound session. */
  readonly userId: string;

  /** Organization the session had selected at issuance. */
  readonly organizationId: string;

  /** Active membership the session used at issuance. */
  readonly memberId: string;

  /** Session version at issuance, including changes of organization. */
  readonly sessionVersion: number;

  /** Instant at which the ticket was issued. */
  readonly issuedAt: Date;

  /** Exclusive deadline of the ticket. */
  readonly expiresAt: Date;

  /** When the ticket was used up, or null while it has not been used. */
  readonly redeemedAt: Date | null;
  // #endregion
}
