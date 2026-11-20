import { InvalidSessionStateError } from '../../errors/session/invalid-session-state.error.js';
import { SessionEndedError } from '../../errors/session/session-ended.error.js';
import type { SessionAuthenticationMethod } from '../../value-objects/session/session-authentication-method.value-object.js';
import type { SessionMembership } from '../../value-objects/session/session-membership.value-object.js';
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
 * - either session also ends after the inactivity of the authentication policy of the organization
 *   it names (1 hour, 12 hours, 7 days or 30 days; 12 hours without one, decision 8 of P2c), which
 *   its state carries as it was read with it; an active introspection is activity. Activity is
 *   recorded at most once a minute, so the inactivity counts from the last recorded minute;
 * - a revoked session never becomes active again; revoking a session that already ended changes
 *   nothing;
 * - a session acts on at most one organization, through a membership of its account (P2b plan,
 *   decision 2, `PUT /internal/v1/sessions/{sessionId}/organization`): chosen while the session is
 *   active, with the next version; choosing the same membership again changes nothing. A new
 *   session starts in the membership its sign-in found, or in none. The session acts on its
 *   organization only while that very membership is active: a removal ends it for good, since a
 *   person who joins again gets a new membership (`asyncapi/organization-service.yaml`);
 * - a session records when its person last proved who they are (decision 4 of P2c, "Recent
 *   authentication" of `openapi/internal/identity-service.yaml`), and how: `password` for a first
 *   factor, `two-step` for a second one (P2c-2). A window opened by a password counts only for an
 *   account without two-step verification; a sign-in on a trusted device opens none. The guarded
 *   routes require it within the last 10 minutes. A change or a reset of the password ends it in
 *   the sessions it leaves open, turning two-step verification on ends the windows opened by a
 *   password; the window belongs to one session.
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
   * Property DEFAULT_INACTIVITY_TIMEOUT_MINUTES
   *
   * @description
   * Time without activity after which a session without an organization, or of an organization
   * without a policy, ends: 12 hours, in minutes.
   *
   * @type {number}
   * @readonly
   */
  public static readonly DEFAULT_INACTIVITY_TIMEOUT_MINUTES: number = 720;

  /**
   * Property LONGEST_INACTIVITY_TIMEOUT_MINUTES
   *
   * @description
   * The longest inactivity a policy may set: 30 days, in minutes.
   *
   * @type {number}
   * @readonly
   */
  public static readonly LONGEST_INACTIVITY_TIMEOUT_MINUTES: number = 43_200;

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
   * Property RECENT_AUTHENTICATION_MS
   *
   * @description
   * How long a proof of who the person is counts as recent: 10 minutes (decision 4 of P2c).
   *
   * @type {number}
   * @readonly
   */
  public static readonly RECENT_AUTHENTICATION_MS: number = 10 * 60_000;

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
   * Property organizationId
   *
   * @description
   * Current organization of the session, or `null`.
   *
   * @type {string | null}
   * @readonly
   */
  public get organizationId(): string | null {
    return this.state.organizationId;
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

  /** The earliest absolute or inactivity deadline, used for the P4 realtime session lease. */
  public get activeUntil(): Date {
    return new Date(
      Math.min(
        this.state.expiresAt.getTime(),
        this.inactivityDeadline(this.state.inactivityTimeoutMinutes),
      ),
    );
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
   * The session a sign-in opens at `now`, active from then, at version 1, in the membership of the
   * last organization the account chose when it is still active there, else in none.
   *
   * @param {string} userId - Account the session signs in.
   * @param {boolean} persistent - Whether the cookie outlives the browser.
   * @param {Date} now - When the sign-in succeeded.
   * @param {SessionMembership | null} membership - The membership the session starts in.
   * @param {SessionAuthenticationMethod | null} authentication - The proof the sign-in brought,
   * which opens the window of recent authentication; `null` for a sign-in on a trusted device of an
   * account with two-step verification, which opens none.
   * @returns {SessionStart} The session to store.
   */
  public static start(
    userId: string,
    persistent: boolean,
    now: Date,
    membership: SessionMembership | null = null,
    authentication: SessionAuthenticationMethod | null = 'password',
  ): SessionStart {
    return {
      userId,
      persistent,
      organizationId: membership?.organizationId ?? null,
      memberId: membership?.memberId ?? null,
      lastActiveAt: now,
      expiresAt: new Date(now.getTime() + Session.ABSOLUTE_LIFETIME_MS),
      signedInAt: now,
      authenticatedAt: authentication === null ? null : now,
      twoStepAuthenticatedAt: authentication === 'two-step' ? now : null,
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
    if ((state.organizationId === null) !== (state.memberId === null)) {
      throw new InvalidSessionStateError('an organization comes with its membership');
    }
    if (!Number.isInteger(state.inactivityTimeoutMinutes) || state.inactivityTimeoutMinutes < 1) {
      throw new InvalidSessionStateError('the inactivity is a positive number of minutes');
    }
    return new Session(state);
  }

  /**
   * Method isActiveAt
   *
   * @description
   * Whether the session signs its browser in at `now`: not revoked, before its absolute expiry and
   * within the inactivity of its organization after its last activity.
   *
   * @param {Date} now - The instant of the check.
   * @returns {boolean} Whether the session is active.
   */
  public isActiveAt(now: Date): boolean {
    return (
      this.state.revokedAt === null &&
      now.getTime() < this.state.expiresAt.getTime() &&
      !this.isIdleLongerThan(this.state.inactivityTimeoutMinutes, now)
    );
  }

  /**
   * Method isIdleLongerThan
   *
   * @description
   * Whether the session was idle for at least an inactivity at `now`: the rule the choice of an
   * organization applies with the policy of the organization chosen ("choosing an organization
   * never revives a session its own policy would have closed").
   *
   * @param {number} minutes - The inactivity, in minutes.
   * @param {Date} now - The instant of the check.
   * @returns {boolean} `true` when that inactivity closes the session.
   */
  public isIdleLongerThan(minutes: number, now: Date): boolean {
    return now.getTime() >= this.inactivityDeadline(minutes);
  }

  /** Millisecond timestamp at which the supplied inactivity rule stops the session. */
  private inactivityDeadline(minutes: number): number {
    return this.state.lastActiveAt.getTime() + minutes * 60_000;
  }

  /**
   * Method recordActivity
   *
   * @description
   * Records that the session was used at `now`, which starts its inactivity again. The
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
   * Method isActingThrough
   *
   * @description
   * Whether the session acts on its organization through this membership, the active one of its
   * account in that organization: `false` without an organization, and once the membership it
   * chose was removed, even if the person joined again.
   *
   * @param {string | null} activeMemberId - The active membership of the account in the
   * organization of the session, or `null` when it has none.
   * @returns {boolean} Whether the session acts on its organization.
   */
  public isActingThrough(activeMemberId: string | null): boolean {
    return this.state.memberId !== null && this.state.memberId === activeMemberId;
  }

  /**
   * Method chooseOrganization
   *
   * @description
   * Makes an organization the current one of the session, through the active membership of its
   * account there, with the next version; the session follows the inactivity of that organization
   * from then. The same membership again returns this session.
   *
   * @param {SessionMembership} membership - The membership the session acts through from now.
   * @param {Date} now - When the organization is chosen.
   * @param {number} inactivityTimeoutMinutes - The inactivity of the policy of that organization.
   * @returns {Session} The session to store, or this one when nothing changes.
   * @throws {SessionEndedError} When the session is no longer active, or was idle for longer than
   * the inactivity of the organization chosen.
   */
  public chooseOrganization(
    membership: SessionMembership,
    now: Date,
    inactivityTimeoutMinutes: number = this.state.inactivityTimeoutMinutes,
  ): Session {
    if (!this.isActiveAt(now) || this.isIdleLongerThan(inactivityTimeoutMinutes, now)) {
      throw new SessionEndedError();
    }
    if (this.isActingThrough(membership.memberId)) {
      return this;
    }
    return new Session({
      ...this.state,
      organizationId: membership.organizationId,
      memberId: membership.memberId,
      inactivityTimeoutMinutes,
      version: this.state.version + 1,
    });
  }

  /**
   * Method closeForInactivity
   *
   * @description
   * Closes a session that the inactivity of the organization it was about to choose would have
   * closed, with the next version and without `session.revoked.v1`: a session that "closes for
   * inactivity emits nothing" (`asyncapi/identity-service.yaml`).
   *
   * @param {Date} now - When it is closed.
   * @returns {Session} The closed session.
   */
  public closeForInactivity(now: Date): Session {
    return new Session({ ...this.state, revokedAt: now, version: this.state.version + 1 });
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

  /**
   * Method isRecentlyAuthenticatedAt
   *
   * @description
   * Whether the person of the session proved who they are within the 10 minutes before an instant,
   * in a way that counts for the account: a second factor for an account with two-step
   * verification, any proof otherwise. A window counts as a second factor while
   * `twoStepAuthenticatedAt` is its very instant; any other window counts as a password.
   *
   * @param {Date} now - The instant.
   * @param {boolean} twoStepRequired - Whether the account has two-step verification.
   * @returns {boolean} `true` inside a window that counts.
   */
  public isRecentlyAuthenticatedAt(now: Date, twoStepRequired: boolean = false): boolean {
    const authenticatedAt: Date | null = this.state.authenticatedAt;
    return (
      authenticatedAt !== null &&
      now.getTime() < authenticatedAt.getTime() + Session.RECENT_AUTHENTICATION_MS &&
      (!twoStepRequired || this.opensByTwoStep())
    );
  }

  /**
   * Method authenticate
   *
   * @description
   * Records that the person of an active session proved who they are now, and how, which opens its
   * window of recent authentication.
   *
   * @param {Date} now - When they proved it.
   * @param {SessionAuthenticationMethod} method - A password or a second factor.
   * @returns {Session} The session with its recent authentication.
   * @throws {SessionEndedError} When the session is no longer active.
   */
  public authenticate(now: Date, method: SessionAuthenticationMethod = 'password'): Session {
    if (!this.isActiveAt(now)) {
      throw new SessionEndedError();
    }
    return new Session({
      ...this.state,
      authenticatedAt: now,
      twoStepAuthenticatedAt: method === 'two-step' ? now : null,
    });
  }

  /**
   * Method endRecentAuthentication
   *
   * @description
   * Ends the recent authentication of the session, as a change or a reset of the password does to
   * the sessions it leaves open (`every-window`), or only a window opened by a password, as turning
   * two-step verification on does to the other sessions (`password-windows`).
   *
   * @param {'every-window' | 'password-windows'} scope - Which windows end.
   * @returns {Session} The session without that recent authentication, or this one.
   */
  public endRecentAuthentication(
    scope: 'every-window' | 'password-windows' = 'every-window',
  ): Session {
    if (
      this.state.authenticatedAt === null ||
      (scope === 'password-windows' && this.opensByTwoStep())
    ) {
      return this;
    }
    return new Session({ ...this.state, authenticatedAt: null, twoStepAuthenticatedAt: null });
  }

  /**
   * Method opensByTwoStep
   *
   * @description
   * Whether the current window was opened by a second factor: `twoStepAuthenticatedAt` is the
   * instant of `authenticatedAt`. A later window of a password, by this version or a previous one,
   * moves `authenticatedAt` alone and ends the match.
   *
   * @returns {boolean} `true` for a window of a second factor.
   */
  private opensByTwoStep(): boolean {
    const authenticatedAt: Date | null = this.state.authenticatedAt;
    const twoStepAt: Date | null = this.state.twoStepAuthenticatedAt;
    return (
      authenticatedAt !== null &&
      twoStepAt !== null &&
      authenticatedAt.getTime() === twoStepAt.getTime()
    );
  }
  // #endregion
}
