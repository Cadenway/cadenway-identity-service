import { InvalidSessionStateError } from '../../errors/session/invalid-session-state.error.js';
import { SessionEndedError } from '../../errors/session/session-ended.error.js';
import type { SessionStart } from '../../value-objects/session/session-start.value-object.js';
import type { SessionState } from '../../value-objects/session/session-state.value-object.js';

/**
 * Class Session
 *
 * @description
 * A sign-in session of a browser. Rules, from `openapi/public/auth.yaml` (`SetSessionCookie`,
 * `Session`), `openapi/internal/identity-service.yaml` (introspection, revocation), the
 * `cw-identity-security` skill and decision 3 of the walking skeleton (`docs/integration.md`):
 *
 * - a session ends at `expiresAt` at the latest: 30 days after the sign-in. With "Rester connecté
 *   pendant 30 jours" the cookie lasts until then (`Max-Age`); without it the cookie ends with the
 *   browser, and this service keeps the same 30-day bound (decision of this service: the contract
 *   requires a bound for both and names none for a session cookie);
 * - either session also ends after 12 hours without activity, as the contract says for both; an
 *   active introspection is activity. Activity is recorded at most once a minute, so the 12 hours
 *   count from the last recorded minute;
 * - a revoked session never becomes active again; revoking a session that already ended changes
 *   nothing;
 * - a session belongs to no organization yet.
 */
export class Session {
  // #region Properties
  /**
   * Property ABSOLUTE_LIFETIME_MS
   *
   * @description
   * Longest life of a session, whatever its activity: 30 days, in milliseconds.
   *
   * @type {number}
   * @readonly
   */
  public static readonly ABSOLUTE_LIFETIME_MS: number = 30 * 24 * 60 * 60_000;

  /**
   * Property INACTIVITY_TIMEOUT_MS
   *
   * @description
   * Time without activity after which a session ends: 12 hours, in milliseconds.
   *
   * @type {number}
   * @readonly
   */
  public static readonly INACTIVITY_TIMEOUT_MS: number = 12 * 60 * 60_000;

  /**
   * Property ACTIVITY_RESOLUTION_MS
   *
   * @description
   * Activity closer than this to the recorded one is not written again: one write a minute at most
   * per session, whatever the number of requests.
   *
   * @type {number}
   * @readonly
   */
  public static readonly ACTIVITY_RESOLUTION_MS: number = 60_000;

  /**
   * Property state
   *
   * @description
   * The state of the session; a change returns a new `Session`.
   *
   * @type {SessionState}
   * @readonly
   */
  private readonly state: SessionState;

  /**
   * Property id
   *
   * @description
   * Id of the session.
   *
   * @type {string}
   * @readonly
   */
  public get id(): string {
    return this.state.id;
  }

  /**
   * Property userId
   *
   * @description
   * Account of the session.
   *
   * @type {string}
   * @readonly
   */
  public get userId(): string {
    return this.state.userId;
  }

  /**
   * Property snapshot
   *
   * @description
   * The state to store.
   *
   * @type {SessionState}
   * @readonly
   */
  public get snapshot(): SessionState {
    return this.state;
  }
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Keeps a state checked by `restore`.
   *
   * @param {SessionState} state - The checked state.
   * @constructor
   */
  private constructor(state: SessionState) {
    this.state = state;
  }
  // #endregion

  // #region Methods
  /**
   * Method start
   *
   * @description
   * The session a sign-in opens at `now`, active from then, at version 1.
   *
   * @param {string} userId - Account the session signs in.
   * @param {boolean} persistent - Whether the cookie outlives the browser.
   * @param {Date} now - When the sign-in succeeded.
   * @returns {SessionStart} The session to store.
   */
  public static start(userId: string, persistent: boolean, now: Date): SessionStart {
    return {
      userId,
      persistent,
      lastActiveAt: now,
      expiresAt: new Date(now.getTime() + Session.ABSOLUTE_LIFETIME_MS),
      version: 1,
    };
  }

  /**
   * Method restore
   *
   * @description
   * Rebuilds a stored session.
   *
   * @param {SessionState} state - The stored state.
   * @returns {Session} The session.
   * @throws {InvalidSessionStateError} When the version is not a positive integer.
   */
  public static restore(state: SessionState): Session {
    if (!Number.isInteger(state.version) || state.version < 1) {
      throw new InvalidSessionStateError('the version is a positive integer');
    }
    return new Session(state);
  }

  /**
   * Method isActiveAt
   *
   * @description
   * Whether the session signs its browser in at `now`: not revoked, before its absolute expiry and
   * less than 12 hours after its last activity.
   *
   * @param {Date} now - The instant of the check.
   * @returns {boolean} Whether the session is active.
   */
  public isActiveAt(now: Date): boolean {
    const instant: number = now.getTime();
    return (
      this.state.revokedAt === null &&
      instant < this.state.expiresAt.getTime() &&
      instant < this.state.lastActiveAt.getTime() + Session.INACTIVITY_TIMEOUT_MS
    );
  }

  /**
   * Method recordActivity
   *
   * @description
   * Records that the session was used at `now`, which starts its 12 hours of inactivity again. The
   * same session is returned when the recorded activity is less than a minute old.
   *
   * @param {Date} now - The instant of the activity.
   * @returns {Session} The session to store, or this one when nothing changes.
   * @throws {SessionEndedError} When the session is no longer active.
   */
  public recordActivity(now: Date): Session {
    if (!this.isActiveAt(now)) {
      throw new SessionEndedError();
    }
    if (now.getTime() - this.state.lastActiveAt.getTime() < Session.ACTIVITY_RESOLUTION_MS) {
      return this;
    }
    return new Session({ ...this.state, lastActiveAt: now });
  }

  /**
   * Method revoke
   *
   * @description
   * Ends the session before its expiry (`session.revoked.v1`), with the next version.
   *
   * @param {Date} now - When the session is revoked.
   * @returns {Session} The revoked session.
   * @throws {SessionEndedError} When the session already ended: there is nothing to revoke.
   */
  public revoke(now: Date): Session {
    if (!this.isActiveAt(now)) {
      throw new SessionEndedError();
    }
    return new Session({ ...this.state, revokedAt: now, version: this.state.version + 1 });
  }
  // #endregion
}
