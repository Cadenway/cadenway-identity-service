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
  return Session.restore({
    ...start,
    id: '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60',
    revokedAt: null,
    inactivityTimeoutMinutes: Session.DEFAULT_INACTIVITY_TIMEOUT_MINUTES,
  });
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

/**
 * Constant MINUTE
 *
 * @description
 * One minute, in milliseconds.
 *
 * @type {number}
 */
const MINUTE: number = 60_000;

describe('Session recent authentication', () => {
  it('starts recently authenticated by its sign-in, which it records', () => {
    const start: SessionStart = Session.start('user', false, SIGNED_IN_AT);

    expect(start.signedInAt).toEqual(SIGNED_IN_AT);
    expect(start.authenticatedAt).toEqual(SIGNED_IN_AT);
  });

  it('counts a proof as recent for 10 minutes', () => {
    const session: Session = opened(false);

    expect(session.isRecentlyAuthenticatedAt(at(10 * MINUTE - 1))).toBe(true);
    expect(session.isRecentlyAuthenticatedAt(at(10 * MINUTE))).toBe(false);
  });

  it('opens the window again from a new proof, without a new version', () => {
    const session: Session = opened(false);
    const confirmed: Session = session.authenticate(at(3 * HOUR));

    expect(confirmed.snapshot.authenticatedAt).toEqual(at(3 * HOUR));
    expect(confirmed.snapshot.version).toBe(session.snapshot.version);
    expect(confirmed.isRecentlyAuthenticatedAt(at(3 * HOUR + 9 * MINUTE))).toBe(true);
  });

  it('refuses a proof in a session that ended', () => {
    expect(() => opened(false).authenticate(at(12 * HOUR))).toThrow(SessionEndedError);
    const revoked: Session = opened(false).revoke(at(MINUTE));
    expect(() => revoked.authenticate(at(2 * MINUTE))).toThrow(SessionEndedError);
  });

  it('ends the recent authentication, and returns a session without one as it is', () => {
    const ended: Session = opened(false).endRecentAuthentication();

    expect(ended.snapshot.authenticatedAt).toBeNull();
    expect(ended.isRecentlyAuthenticatedAt(at(MINUTE))).toBe(false);
    expect(ended.endRecentAuthentication()).toBe(ended);
  });
});

const TWO_STEP_SIGNED_IN_AT: Date = new Date('2026-11-09T07:42:00Z');
const TWO_STEP_HOUR: number = 60 * MINUTE;
const ATELIER_NORD: SessionMembership = {
  organizationId: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f',
  memberId: '019a6b10-0000-7000-8000-000000000001',
};

/**
 * Function at
 *
 * @description
 * An instant after the sign-in of the session of Camille Martin.
 *
 * @param {number} milliseconds - Delay after the sign-in.
 * @returns {Date} The instant.
 */
function twoStepAt(milliseconds: number): Date {
  return new Date(TWO_STEP_SIGNED_IN_AT.getTime() + milliseconds);
}

/**
 * Function opened
 *
 * @description
 * A session of Camille Martin opened with a proof, and the inactivity of its organization.
 *
 * @param {'password' | 'two-step' | null} authentication - The proof of the sign-in.
 * @param {number} inactivityTimeoutMinutes - The inactivity of its policy.
 * @returns {Session} The session.
 */
function openedTwoStep(
  authentication: 'password' | 'two-step' | null,
  inactivityTimeoutMinutes: number = 720,
): Session {
  return Session.restore({
    ...Session.start(
      '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
      false,
      TWO_STEP_SIGNED_IN_AT,
      null,
      authentication,
    ),
    id: '019a6914-2f7a-7b3c-9d4e-5f6a7b8c9d01',
    revokedAt: null,
    inactivityTimeoutMinutes,
  });
}

describe('Session and two-step verification (P2c-2)', () => {
  it('counts a window opened by a password only for an account without two-step verification', () => {
    const session: Session = openedTwoStep('password');

    expect(session.isRecentlyAuthenticatedAt(twoStepAt(MINUTE), false)).toBe(true);
    expect(session.isRecentlyAuthenticatedAt(twoStepAt(MINUTE), true)).toBe(false);
  });

  it('counts a window opened by a second factor for both, within 10 minutes', () => {
    const session: Session = openedTwoStep('two-step');

    expect(session.isRecentlyAuthenticatedAt(twoStepAt(9 * MINUTE), true)).toBe(true);
    expect(session.isRecentlyAuthenticatedAt(twoStepAt(9 * MINUTE), false)).toBe(true);
    expect(session.isRecentlyAuthenticatedAt(twoStepAt(10 * MINUTE), true)).toBe(false);
  });

  it('opens no window for a sign-in on a trusted device', () => {
    const session: Session = openedTwoStep(null);

    expect(session.snapshot.authenticatedAt).toBeNull();
    expect(session.isRecentlyAuthenticatedAt(twoStepAt(0), false)).toBe(false);
  });

  it('counts a window a previous version recorded without its method as a password', () => {
    const session: Session = Session.restore({
      ...openedTwoStep('password').snapshot,
      twoStepAuthenticatedAt: null,
    });

    expect(session.isRecentlyAuthenticatedAt(twoStepAt(MINUTE), false)).toBe(true);
    expect(session.isRecentlyAuthenticatedAt(twoStepAt(MINUTE), true)).toBe(false);
  });

  it('counts a window as a second factor only while it is the instant of the second factor', () => {
    const twoStep: Session = openedTwoStep('two-step');
    // A previous version records a password window by moving authenticated_at alone.
    const movedByPassword: Session = Session.restore({
      ...twoStep.snapshot,
      authenticatedAt: twoStepAt(MINUTE),
    });

    expect(twoStep.isRecentlyAuthenticatedAt(twoStepAt(2 * MINUTE), true)).toBe(true);
    expect(movedByPassword.isRecentlyAuthenticatedAt(twoStepAt(2 * MINUTE), false)).toBe(true);
    expect(movedByPassword.isRecentlyAuthenticatedAt(twoStepAt(2 * MINUTE), true)).toBe(false);
    expect(movedByPassword.endRecentAuthentication('password-windows').snapshot).toMatchObject({
      authenticatedAt: null,
      twoStepAuthenticatedAt: null,
    });
  });

  it('records the method of a re-authentication', () => {
    const confirmed: Session = openedTwoStep(null).authenticate(
      twoStepAt(TWO_STEP_HOUR),
      'two-step',
    );

    expect(confirmed.snapshot).toMatchObject({
      authenticatedAt: twoStepAt(TWO_STEP_HOUR),
      twoStepAuthenticatedAt: twoStepAt(TWO_STEP_HOUR),
    });
    expect(confirmed.isRecentlyAuthenticatedAt(twoStepAt(TWO_STEP_HOUR + MINUTE), true)).toBe(true);
  });

  it('ends only the windows opened by a password when two-step verification turns on', () => {
    const password: Session = openedTwoStep('password');
    const twoStep: Session = openedTwoStep('two-step');

    expect(
      password.endRecentAuthentication('password-windows').snapshot.authenticatedAt,
    ).toBeNull();
    expect(twoStep.endRecentAuthentication('password-windows')).toBe(twoStep);
    expect(twoStep.endRecentAuthentication('every-window').snapshot.authenticatedAt).toBeNull();
  });

  it('closes after the inactivity of the policy of its organization', () => {
    const hourly: Session = openedTwoStep('password', 60);

    expect(hourly.isActiveAt(twoStepAt(59 * MINUTE))).toBe(true);
    expect(hourly.isActiveAt(twoStepAt(TWO_STEP_HOUR))).toBe(false);
    expect(openedTwoStep('password', 43_200).isActiveAt(twoStepAt(29 * 24 * TWO_STEP_HOUR))).toBe(
      true,
    );
  });

  it('takes the inactivity of the organization it chooses', () => {
    const chosen: Session = openedTwoStep('password').chooseOrganization(
      ATELIER_NORD,
      twoStepAt(MINUTE),
      60,
    );

    expect(chosen.snapshot.inactivityTimeoutMinutes).toBe(60);
    expect(chosen.isActiveAt(twoStepAt(59 * MINUTE))).toBe(true);
    expect(chosen.isActiveAt(twoStepAt(TWO_STEP_HOUR))).toBe(false);
  });

  it('refuses to choose an organization whose inactivity would have closed it, and closes it without a revocation event', () => {
    const idle: Session = openedTwoStep('password');

    expect(idle.isIdleLongerThan(60, twoStepAt(2 * TWO_STEP_HOUR))).toBe(true);
    expect(() => idle.chooseOrganization(ATELIER_NORD, twoStepAt(2 * TWO_STEP_HOUR), 60)).toThrow(
      SessionEndedError,
    );
    const closed: Session = idle.closeForInactivity(twoStepAt(2 * TWO_STEP_HOUR));
    expect(closed.isActiveAt(twoStepAt(2 * TWO_STEP_HOUR))).toBe(false);
    expect(closed.snapshot.version).toBe(2);
  });
});
