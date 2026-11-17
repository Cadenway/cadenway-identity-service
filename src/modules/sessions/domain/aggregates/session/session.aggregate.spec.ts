import { describe, expect, it } from 'vitest';

import { InvalidSessionStateError } from '../../errors/session/invalid-session-state.error.js';
import { SessionEndedError } from '../../errors/session/session-ended.error.js';
import type { SessionMembership } from '../../value-objects/session/session-membership.value-object.js';
import type { SessionStart } from '../../value-objects/session/session-start.value-object.js';
import { Session } from './session.aggregate.js';

/**
 * Constant SIGNED_IN_AT
 *
 * @description
 * When the session of the specs was opened.
 *
 * @type {Date}
 */
const SIGNED_IN_AT: Date = new Date('2026-11-08T13:07:00Z');

/**
 * Constant HOUR
 *
 * @description
 * One hour, in milliseconds.
 *
 * @type {number}
 */
const HOUR: number = 60 * 60_000;

/** The membership of Camille Martin in Atelier Nord. */
const ATELIER_NORD_MEMBERSHIP: SessionMembership = {
  organizationId: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f',
  memberId: '019a6b10-0000-7000-8000-000000000001',
};

/**
 * Function at
 *
 * @description
 * An instant after `SIGNED_IN_AT`.
 *
 * @param {number} milliseconds - Delay after the sign-in.
 * @returns {Date} The instant.
 */
function at(milliseconds: number): Date {
  return new Date(SIGNED_IN_AT.getTime() + milliseconds);
}

/**
 * Function opened
 *
 * @description
 * The session of Camille Martin, stored as `start` returned it.
 *
 * @param {boolean} persistent - Whether "Rester connecté pendant 30 jours" was ticked.
 * @returns {Session} The session.
 */
function opened(persistent: boolean): Session {
  const start: SessionStart = Session.start(
    '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
    persistent,
    SIGNED_IN_AT,
  );
  return Session.restore({ ...start, id: '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60', revokedAt: null });
}

describe('Session', () => {
  it('opens at version 1 and ends 30 days after the sign-in at the latest, persistent or not', () => {
    for (const persistent of [true, false]) {
      const start: SessionStart = Session.start('user', persistent, SIGNED_IN_AT);

      expect(start.version).toBe(1);
      expect(start.persistent).toBe(persistent);
      expect(start.lastActiveAt).toEqual(SIGNED_IN_AT);
      expect(start.expiresAt).toEqual(at(30 * 24 * HOUR));
    }
  });

  it('ends after 12 hours without activity, persistent or not', () => {
    for (const persistent of [true, false]) {
      const session: Session = opened(persistent);

      expect(session.isActiveAt(at(12 * HOUR - 1))).toBe(true);
      expect(session.isActiveAt(at(12 * HOUR))).toBe(false);
    }
  });

  it('starts the 12 hours again from each recorded activity', () => {
    const active: Session = opened(true).recordActivity(at(11 * HOUR));

    expect(active.snapshot.lastActiveAt).toEqual(at(11 * HOUR));
    expect(active.isActiveAt(at(22 * HOUR))).toBe(true);
    expect(active.isActiveAt(at(23 * HOUR))).toBe(false);
  });

  it('records activity at most once a minute', () => {
    const session: Session = opened(false);

    expect(session.recordActivity(at(59_999))).toBe(session);
    expect(session.recordActivity(at(60_000))).not.toBe(session);
  });

  it('ends at its absolute expiry whatever its activity', () => {
    let session: Session = opened(true);
    for (let hour: number = 11; hour < 30 * 24; hour += 11) {
      session = session.recordActivity(at(hour * HOUR));
    }

    expect(session.isActiveAt(at(30 * 24 * HOUR - 1))).toBe(true);
    expect(session.isActiveAt(at(30 * 24 * HOUR))).toBe(false);
  });

  it('revokes an active session with the next version, and never again', () => {
    const revoked: Session = opened(false).revoke(at(HOUR));

    expect(revoked.snapshot.revokedAt).toEqual(at(HOUR));
    expect(revoked.snapshot.version).toBe(2);
    expect(revoked.isActiveAt(at(HOUR))).toBe(false);
    expect(() => revoked.revoke(at(2 * HOUR))).toThrow(SessionEndedError);
    expect(() => revoked.recordActivity(at(2 * HOUR))).toThrow(SessionEndedError);
  });

  it('refuses to revoke or touch a session that expired', () => {
    expect(() => opened(false).revoke(at(13 * HOUR))).toThrow(SessionEndedError);
    expect(() => opened(false).recordActivity(at(13 * HOUR))).toThrow(SessionEndedError);
  });

  it('refuses a stored session without a positive version', () => {
    expect(() => Session.restore({ ...opened(true).snapshot, version: 0 })).toThrow(
      InvalidSessionStateError,
    );
  });

  it('starts in no organization, or in the membership the sign-in found', () => {
    expect(Session.start('user', false, SIGNED_IN_AT)).toMatchObject({
      organizationId: null,
      memberId: null,
    });
    expect(Session.start('user', false, SIGNED_IN_AT, ATELIER_NORD_MEMBERSHIP)).toMatchObject({
      organizationId: ATELIER_NORD_MEMBERSHIP.organizationId,
      memberId: ATELIER_NORD_MEMBERSHIP.memberId,
      version: 1,
    });
  });

  it('chooses an organization with the next version, and the same membership changes nothing', () => {
    const chosen: Session = opened(false).chooseOrganization(ATELIER_NORD_MEMBERSHIP, at(HOUR));

    expect(chosen.organizationId).toBe(ATELIER_NORD_MEMBERSHIP.organizationId);
    expect(chosen.snapshot.version).toBe(2);
    expect(chosen.isActingThrough(ATELIER_NORD_MEMBERSHIP.memberId)).toBe(true);
    expect(chosen.chooseOrganization(ATELIER_NORD_MEMBERSHIP, at(HOUR))).toBe(chosen);
    expect(chosen.revoke(at(2 * HOUR)).snapshot.version).toBe(3);
  });

  it('acts on its organization only through the membership it chose', () => {
    const chosen: Session = opened(false).chooseOrganization(ATELIER_NORD_MEMBERSHIP, at(HOUR));

    expect(opened(false).isActingThrough(null)).toBe(false);
    expect(chosen.isActingThrough(null)).toBe(false);
    expect(chosen.isActingThrough('019a6b10-0000-7000-8000-000000000099')).toBe(false);
  });

  it('refuses to choose an organization for a session that ended', () => {
    expect(() =>
      opened(false).revoke(at(HOUR)).chooseOrganization(ATELIER_NORD_MEMBERSHIP, at(HOUR)),
    ).toThrow(SessionEndedError);
  });

  it('refuses a stored organization without its membership', () => {
    expect(() =>
      Session.restore({
        ...opened(true).snapshot,
        organizationId: ATELIER_NORD_MEMBERSHIP.organizationId,
      }),
    ).toThrow(InvalidSessionStateError);
  });
});
