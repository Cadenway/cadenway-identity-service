import type { SessionMembership } from './session-membership.value-object.js';

/**
 * Interface SessionState
 *
 * @description
 * A stored session. Its token is never part of it: the repository keeps only the SHA-256 hash.
 */
export interface SessionState {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id assigned by PostgreSQL.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property userId
   *
   * @description
   * Account the session signs in.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property persistent
   *
   * @description
   * Whether the cookie outlives the browser (`rememberMe`).
   *
   * @type {boolean}
   * @readonly
   */
  readonly persistent: boolean;

  /**
   * Property lastActiveAt
   *
   * @description
   * Last recorded activity, within `ACTIVITY_RESOLUTION_MS`.
   *
   * @type {Date}
   * @readonly
   */
  readonly lastActiveAt: Date;

  /**
   * Property expiresAt
   *
   * @description
   * When the session ends at the latest, whatever its activity.
   *
   * @type {Date}
   * @readonly
   */
  readonly expiresAt: Date;

  /**
   * Property revokedAt
   *
   * @description
   * When the session was revoked, or `null`.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly revokedAt: Date | null;

  /**
   * Property organizationId
   *
   * @description
   * Current organization of the session, or `null` when it has none.
   *
   * @type {string | null}
   * @readonly
   */
  readonly organizationId: string | null;

  /**
   * Property memberId
   *
   * @description
   * The membership the session acts through in its current organization, or `null` without one.
   *
   * @type {string | null}
   * @readonly
   */
  readonly memberId: string | null;

  /** Membership that vouched for a SAML sign-in, independent of the current organization. */
  readonly samlMembership?: SessionMembership | null;

  /**
   * Property version
   *
   * @description
   * Version of the session: 1 when opened, one more at each choice of an organization and at the
   * revocation. Activity is not a change of version.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;

  /**
   * Property signedInAt
   *
   * @description
   * When the sign-in opened the session (`signedInAt` of `OpenSession`).
   *
   * @type {Date}
   * @readonly
   */
  readonly signedInAt: Date;

  /**
   * Property authenticatedAt
   *
   * @description
   * When the person of the session last proved who they are: the sign-in, a confirmed password or
   * the current password of a change; `null` once a change or a reset of the password ended it.
   * Not a change of version, like activity.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly authenticatedAt: Date | null;

  /**
   * Property twoStepAuthenticatedAt
   *
   * @description
   * When the window was opened by a second factor (P2c-2): the instant of `authenticatedAt` itself;
   * `null` for a window of a password, without a window, and for the rows a previous version wrote.
   * A window counts as a second factor only while both instants are equal, so a window a previous
   * version records during a rollout, which writes `authenticated_at` alone, never passes for one.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly twoStepAuthenticatedAt: Date | null;

  /**
   * Property inactivityTimeoutMinutes
   *
   * @description
   * Minutes without activity after which the session closes: the inactivity of the authentication
   * policy of the organization it names, read with it, 720 without one (decision 8 of P2c). Not
   * stored on the session: a change of the policy applies from the next introspection.
   *
   * @type {number}
   * @readonly
   */
  readonly inactivityTimeoutMinutes: number;
  // #endregion
}
