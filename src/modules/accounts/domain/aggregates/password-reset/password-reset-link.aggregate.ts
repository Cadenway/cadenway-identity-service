import { ResetLinkUnusableError } from '../../errors/password-reset/reset-link-unusable.error.js';
import type { PasswordResetLinkIssue } from './password-reset-link-issue.aggregate.js';
import type { PasswordResetLinkState } from './password-reset-link-state.aggregate.js';

/**
 * Class PasswordResetLink
 *
 * @description
 * A link to choose a new password ("Mot de passe oublié"). Rules, from `POST /v1/auth/password-reset`
 * of `openapi/public/auth.yaml` and decision 2 of P2c:
 *
 * - it works once, for 30 minutes, from any browser;
 * - a newer link of the account makes it stop working, and so does a change of address;
 * - reading it (`POST /v1/auth/password-reset/inspection`) does not use it; setting a new password
 *   with it does.
 */
export class PasswordResetLink {
  // #region Properties
  /**
   * Property LIFETIME_MS
   *
   * @description
   * How long a link works: 30 minutes ("Il reste valable 30 minutes."; the 1 hour of the e-mail of
   * the mockup is corrected by decision 2).
   *
   * @type {number}
   * @readonly
   */
  public static readonly LIFETIME_MS: number = 30 * 60_000;

  /**
   * Property state
   *
   * @description
   * The state of the link.
   *
   * @type {PasswordResetLinkState}
   * @readonly
   */
  private readonly state: PasswordResetLinkState;

  /**
   * Property id
   *
   * @description
   * Id of the link.
   *
   * @type {string}
   * @readonly
   */
  public get id(): string {
    return this.state.id;
  }

  /**
   * Property snapshot
   *
   * @description
   * The state, for the repository.
   *
   * @type {PasswordResetLinkState}
   * @readonly
   */
  public get snapshot(): PasswordResetLinkState {
    return this.state;
  }
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Keeps a stored state.
   *
   * @param {PasswordResetLinkState} state - The state.
   * @constructor
   */
  private constructor(state: PasswordResetLinkState) {
    this.state = state;
  }
  // #endregion

  // #region Methods
  /**
   * Method expiryFor
   *
   * @description
   * When a link issued at an instant stops working.
   *
   * @param {Date} now - When the link is issued.
   * @returns {Date} 30 minutes later.
   */
  public static expiryFor(now: Date): Date {
    return new Date(now.getTime() + PasswordResetLink.LIFETIME_MS);
  }

  /**
   * Method issue
   *
   * @description
   * A new link of an account.
   *
   * @param {string} userId - The account.
   * @param {string} tokenHash - SHA-256 of its token.
   * @param {Date} now - When it is issued.
   * @returns {PasswordResetLinkIssue} The link to store.
   */
  public static issue(userId: string, tokenHash: string, now: Date): PasswordResetLinkIssue {
    return { userId, tokenHash, expiresAt: PasswordResetLink.expiryFor(now) };
  }

  /**
   * Method restore
   *
   * @description
   * Rebuilds a stored link.
   *
   * @param {PasswordResetLinkState} state - The stored state.
   * @returns {PasswordResetLink} The link.
   */
  public static restore(state: PasswordResetLinkState): PasswordResetLink {
    return new PasswordResetLink(state);
  }

  /**
   * Method worksAt
   *
   * @description
   * Whether the link still works at an instant: neither used nor replaced, and not expired.
   *
   * @param {Date} now - The instant.
   * @returns {boolean} `true` when it can be used.
   */
  public worksAt(now: Date): boolean {
    return (
      this.state.usedAt === null &&
      this.state.replacedAt === null &&
      now.getTime() < this.state.expiresAt.getTime()
    );
  }

  /**
   * Method use
   *
   * @description
   * Uses the link up: it never works again.
   *
   * @param {Date} now - When the new password is set.
   * @returns {PasswordResetLink} The used link.
   * @throws {ResetLinkUnusableError} When it no longer works.
   */
  public use(now: Date): PasswordResetLink {
    if (!this.worksAt(now)) {
      throw new ResetLinkUnusableError();
    }
    return new PasswordResetLink({ ...this.state, usedAt: now });
  }
  // #endregion
}
