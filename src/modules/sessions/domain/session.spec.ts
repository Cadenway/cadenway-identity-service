import { describe, expect, it } from 'vitest';

import { InvalidSessionStateError, SessionEndedError } from './errors.js';
import { Session } from './session.js';
import type { SessionStart } from './session.js';

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
});
