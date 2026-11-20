import { describe, expect, it } from 'vitest';

import { InvalidRealtimeTicketStateError } from '../../errors/realtime-ticket/invalid-realtime-ticket-state.error.js';
import { RealtimeTicketUnusableError } from '../../errors/realtime-ticket/realtime-ticket-unusable.error.js';
import type { RealtimeTicketState } from '../../value-objects/realtime-ticket/realtime-ticket-state.value-object.js';
import type { SessionState } from '../../value-objects/session/session-state.value-object.js';
import { Session } from '../session/session.aggregate.js';
import { RealtimeTicket } from './realtime-ticket.aggregate.js';

const ISSUED_AT = new Date('2026-11-20T09:00:00Z');
const TOKEN_HASH = 'a'.repeat(64);
const USER_ID = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';
const SESSION_ID = '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60';
const ATELIER_NORD = {
  organizationId: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f',
  memberId: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b31',
} as const;
const OTHER_ORGANIZATION = {
  organizationId: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b32',
  memberId: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b33',
} as const;

/** An instant at the specified delay after issuance in milliseconds. */
function at(milliseconds: number): Date {
  return new Date(ISSUED_AT.getTime() + milliseconds);
}

/** Camille Martin's stored session, acting on Atelier Nord unless overridden. */
function opened(overrides: Partial<SessionState> = {}): Session {
  return Session.restore({
    ...Session.start(USER_ID, false, ISSUED_AT, ATELIER_NORD),
    id: SESSION_ID,
    revokedAt: null,
    inactivityTimeoutMinutes: Session.DEFAULT_INACTIVITY_TIMEOUT_MINUTES,
    ...overrides,
  });
}

/** A fresh ticket bound to the given session and to Camille's membership in Atelier Nord. */
function issued(session: Session = opened()): RealtimeTicket {
  return RealtimeTicket.issue(session, ATELIER_NORD.memberId, TOKEN_HASH, ISSUED_AT);
}

describe('RealtimeTicket', () => {
  it('stores only the digest and the verified session binding with a 60-second deadline', () => {
    const ticket = issued(opened({ version: 2 }));

    expect(ticket.snapshot).toEqual({
      tokenHash: TOKEN_HASH,
      sessionId: SESSION_ID,
      userId: USER_ID,
      ...ATELIER_NORD,
      sessionVersion: 2,
      issuedAt: ISSUED_AT,
      expiresAt: at(60_000),
      redeemedAt: null,
    });
  });

  it.each([{ expiresAt: at(10_000) }, { inactivityTimeoutMinutes: 1, lastActiveAt: at(-50_000) }])(
    'ends by the earlier session deadline for %j',
    (state) => {
      const session = opened(state);
      const ticket = issued(session);

      expect(session.activeUntil).toEqual(at(10_000));
      expect(ticket.snapshot.expiresAt).toEqual(at(10_000));
      expect(() => ticket.redeem(session, ATELIER_NORD.memberId, at(10_000))).toThrow(
        RealtimeTicketUnusableError,
      );
    },
  );

  it.each([
    ['ended session', { revokedAt: ISSUED_AT }, ATELIER_NORD.memberId],
    ['expired session', { expiresAt: ISSUED_AT }, ATELIER_NORD.memberId],
    ['no selected organization', { organizationId: null, memberId: null }, null],
    ['missing active membership', {}, null],
    ['replacement membership', {}, OTHER_ORGANIZATION.memberId],
  ] as const)('refuses issuance with %s', (_reason, state, memberId) => {
    expect(() => RealtimeTicket.issue(opened(state), memberId, TOKEN_HASH, ISSUED_AT)).toThrow(
      RealtimeTicketUnusableError,
    );
  });

  it('can be redeemed until the last millisecond and the saved redemption cannot be repeated', () => {
    const session = opened();
    const ticket = issued(session);
    const redeemed = ticket.redeem(session, ATELIER_NORD.memberId, at(59_999));

    expect(ticket.snapshot.redeemedAt).toBeNull();
    expect(redeemed.snapshot.redeemedAt).toEqual(at(59_999));
    expect(() =>
      RealtimeTicket.restore(redeemed.snapshot).redeem(session, ATELIER_NORD.memberId, at(59_999)),
    ).toThrow(RealtimeTicketUnusableError);
    expect(() => ticket.redeem(session, ATELIER_NORD.memberId, at(60_000))).toThrow(
      RealtimeTicketUnusableError,
    );
    expect(() => ticket.redeem(session, ATELIER_NORD.memberId, at(-1))).toThrow(
      RealtimeTicketUnusableError,
    );
  });

  it.each([
    ['different session', { id: 'other-session' }, ATELIER_NORD.memberId],
    ['different account', { userId: 'other-user' }, ATELIER_NORD.memberId],
    [
      'different organization',
      { organizationId: OTHER_ORGANIZATION.organizationId },
      ATELIER_NORD.memberId,
    ],
    ['different session version', { version: 2 }, ATELIER_NORD.memberId],
    [
      'different session membership',
      { memberId: OTHER_ORGANIZATION.memberId },
      OTHER_ORGANIZATION.memberId,
    ],
    ['session revoked after issuance', { revokedAt: at(1_000) }, ATELIER_NORD.memberId],
    ['session expired after issuance', { expiresAt: at(2_000) }, ATELIER_NORD.memberId],
    [
      'session now idle under the current policy',
      { inactivityTimeoutMinutes: 1, lastActiveAt: at(-58_000) },
      ATELIER_NORD.memberId,
    ],
    ['membership removed after issuance', {}, null],
    ['membership replaced after issuance', {}, OTHER_ORGANIZATION.memberId],
  ] as const)('refuses redemption with %s', (_reason, state, memberId) => {
    expect(() => issued().redeem(opened(state), memberId, at(2_000))).toThrow(
      RealtimeTicketUnusableError,
    );
  });

  it('refuses a ticket issued before the session switched away and back', () => {
    const session = opened();
    const switched = session
      .chooseOrganization(OTHER_ORGANIZATION, at(1_000))
      .chooseOrganization(ATELIER_NORD, at(2_000));

    expect(switched.snapshot.version).toBe(session.snapshot.version + 2);
    expect(() => issued(session).redeem(switched, ATELIER_NORD.memberId, at(3_000))).toThrow(
      RealtimeTicketUnusableError,
    );
  });

  it.each([
    { tokenHash: 'not-a-digest' },
    { tokenHash: `${TOKEN_HASH}\n` },
    { sessionVersion: 0 },
    { issuedAt: new Date(Number.NaN) },
    { expiresAt: ISSUED_AT },
    { expiresAt: at(60_001) },
    { redeemedAt: at(-1) },
    { redeemedAt: at(60_000) },
  ] satisfies Partial<RealtimeTicketState>[])('refuses corrupt stored state %j', (state) => {
    expect(() => RealtimeTicket.restore({ ...issued().snapshot, ...state })).toThrow(
      InvalidRealtimeTicketStateError,
    );
  });

  it('copies the stored dates and never includes extra storage fields in its state', () => {
    const row = { ...issued().snapshot, rawValue: 'synthetic-extra-value' };
    const ticket = RealtimeTicket.restore(row);

    row.expiresAt.setTime(ISSUED_AT.getTime());
    ticket.snapshot.issuedAt.setTime(0);

    expect(ticket.snapshot.expiresAt).toEqual(at(60_000));
    expect(ticket.snapshot.issuedAt).toEqual(ISSUED_AT);
    expect(ticket.snapshot).not.toHaveProperty('rawValue');
  });
});
