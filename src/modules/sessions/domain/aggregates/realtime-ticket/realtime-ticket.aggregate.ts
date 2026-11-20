import { InvalidRealtimeTicketStateError } from '../../errors/realtime-ticket/invalid-realtime-ticket-state.error.js';
import { RealtimeTicketUnusableError } from '../../errors/realtime-ticket/realtime-ticket-unusable.error.js';
import type { RealtimeTicketState } from '../../value-objects/realtime-ticket/realtime-ticket-state.value-object.js';
import type { Session } from '../session/session.aggregate.js';

/** Copies only the declared state, keeping externally supplied dates out of the aggregate. */
function copyState(state: RealtimeTicketState): RealtimeTicketState {
  return {
    tokenHash: state.tokenHash,
    sessionId: state.sessionId,
    userId: state.userId,
    organizationId: state.organizationId,
    memberId: state.memberId,
    sessionVersion: state.sessionVersion,
    issuedAt: new Date(state.issuedAt),
    expiresAt: new Date(state.expiresAt),
    redeemedAt: state.redeemedAt === null ? null : new Date(state.redeemedAt),
  };
}

/**
 * Single-use socket ticket bound to one version of a session and its active membership.
 * `openapi/internal/identity-service.yaml` (P4) fixes its 60-second lifetime, digest-only
 * storage and binding revalidation at redemption.
 */
export class RealtimeTicket {
  // #region Properties
  /** Maximum interval between issuing and expiring a ticket, in milliseconds. */
  public static readonly LIFETIME_MS = 60_000;

  /** Ticket state for a repository; the dates are detached from the aggregate. */
  public get snapshot(): RealtimeTicketState {
    return copyState(this.state);
  }
  // #endregion

  // #region Constructor
  /** Keeps the validated, detached state. */
  private constructor(private readonly state: RealtimeTicketState) {}
  // #endregion

  // #region Methods
  /**
   * Issues a ticket bound to a session in its selected organization. The caller has verified the
   * actor, current membership and authentication policy. Only the digest is supplied here.
   */
  public static issue(
    session: Session,
    activeMemberId: string | null,
    tokenHash: string,
    now: Date,
  ): RealtimeTicket {
    const { id, userId, organizationId, memberId, version } = session.snapshot;
    if (
      organizationId === null ||
      memberId === null ||
      !session.isActiveAt(now) ||
      !session.isActingThrough(activeMemberId)
    ) {
      throw new RealtimeTicketUnusableError();
    }
    return RealtimeTicket.restore({
      tokenHash,
      sessionId: id,
      userId,
      organizationId,
      memberId,
      sessionVersion: version,
      issuedAt: now,
      expiresAt: new Date(
        Math.min(now.getTime() + RealtimeTicket.LIFETIME_MS, session.activeUntil.getTime()),
      ),
      redeemedAt: null,
    });
  }

  /** Restores a stored ticket and refuses a bad digest, version or chronological state. */
  public static restore(state: RealtimeTicketState): RealtimeTicket {
    const issuedAt = state.issuedAt.getTime();
    const expiresAt = state.expiresAt.getTime();
    if (
      state.tokenHash.length !== 64 ||
      !/^[a-f0-9]{64}$/.test(state.tokenHash) ||
      !Number.isSafeInteger(state.sessionVersion) ||
      state.sessionVersion < 1 ||
      !(issuedAt < expiresAt && expiresAt - issuedAt <= RealtimeTicket.LIFETIME_MS) ||
      (state.redeemedAt !== null && !RealtimeTicket.isWithinLifetime(state, state.redeemedAt))
    ) {
      throw new InvalidRealtimeTicketStateError();
    }
    return new RealtimeTicket(copyState(state));
  }

  /**
   * Uses the ticket once. The caller reads the currently authorized session and membership and
   * persists the resulting state in the same transaction, with concurrent redemption excluded.
   */
  public redeem(session: Session, activeMemberId: string | null, now: Date): RealtimeTicket {
    const { id, userId, organizationId, memberId, version } = session.snapshot;
    if (
      !this.isOpenAt(now) ||
      !session.isActiveAt(now) ||
      !session.isActingThrough(activeMemberId) ||
      id !== this.state.sessionId ||
      userId !== this.state.userId ||
      organizationId !== this.state.organizationId ||
      memberId !== this.state.memberId ||
      version !== this.state.sessionVersion
    ) {
      throw new RealtimeTicketUnusableError();
    }
    return new RealtimeTicket({ ...this.state, redeemedAt: new Date(now) });
  }

  /** Checks unconsumed lifetime before the caller acquires organization-wide locks. */
  public isOpenAt(now: Date): boolean {
    return this.state.redeemedAt === null && RealtimeTicket.isWithinLifetime(this.state, now);
  }

  /** A use is allowed at the issuance instant and only strictly before expiry. */
  private static isWithinLifetime(state: RealtimeTicketState, now: Date): boolean {
    const instant = now.getTime();
    return state.issuedAt.getTime() <= instant && instant < state.expiresAt.getTime();
  }
  // #endregion
}
