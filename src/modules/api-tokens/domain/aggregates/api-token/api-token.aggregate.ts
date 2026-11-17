import { InvalidApiTokenError } from '../../errors/api-token/invalid-api-token.error.js';
import { API_TOKEN_SCOPES } from '../../policies/api-token/api-token-scopes.policy.js';
import type { ApiTokenDraft } from '../../value-objects/api-token/api-token-draft.value-object.js';
import type { ApiTokenExpiration } from '../../value-objects/api-token/api-token-expiration.value-object.js';
import type { ApiTokenRequest } from '../../value-objects/api-token/api-token-request.value-object.js';
import type { ApiTokenState } from '../../value-objects/api-token/api-token-state.value-object.js';

/**
 * Constant DAY_MS
 *
 * @description
 * One day, in milliseconds.
 *
 * @type {number}
 */
const DAY_MS: number = 24 * 60 * 60_000;

/**
 * Class ApiToken
 *
 * @description
 * A personal API token. Rules, from `openapi/public/api-tokens.yaml`, the P2b plan (decision 6),
 * the mockup's "Jetons d'API" and the `cw-identity-security` skill:
 *
 * - a token belongs to its user and to the current organization of the session that created it,
 *   and acts with the rights of that user there, within its scopes;
 * - its name is trimmed, 1 to 100 characters; it has 1 to 4 scopes among `tasks:read`,
 *   `tasks:write`, `members:read` and `webhooks:manage`, a scope given twice counting once;
 * - it expires 30 days (the default), 90 days or 1 year after its creation, or never; a year is
 *   the same date of the next calendar year, in UTC;
 * - it works while it is neither revoked nor expired; whether its user still belongs to its
 *   organization is a fact of the copy of the memberships, checked by the introspection;
 * - revoking it again changes nothing;
 * - its last use is recorded at most once a minute, without a new version.
 */
export class ApiToken {
  // #region Properties
  /**
   * Property NAME_MAX_LENGTH
   *
   * @description
   * Longest name, in code points (`maxLength: 100`).
   *
   * @type {number}
   * @readonly
   */
  public static readonly NAME_MAX_LENGTH: number = 100;

  /**
   * Property USE_RESOLUTION_MS
   *
   * @description
   * A use closer than this to the recorded one is not written again: one write a minute at most
   * per token ("Recorded at most once a minute").
   *
   * @type {number}
   * @readonly
   */
  public static readonly USE_RESOLUTION_MS: number = 60_000;

  /**
   * Property PREFIX_FORMAT
   *
   * @description
   * The 11 characters a prefix holds: `cw_pat_` and the first 4 base62 characters of the secret.
   *
   * @type {RegExp}
   * @readonly
   */
  private static readonly PREFIX_FORMAT: RegExp = /^cw_pat_[0-9A-Za-z]{4}$/u;

  /**
   * Property state
   *
   * @description
   * The state of the token; a change returns a new `ApiToken`.
   *
   * @type {ApiTokenState}
   * @readonly
   */
  private readonly state: ApiTokenState;

  /**
   * Property id
   *
   * @description
   * Id of the token.
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
   * The state to store.
   *
   * @type {ApiTokenState}
   * @readonly
   */
  public get snapshot(): ApiTokenState {
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
   * @param {ApiTokenState} state - The checked state.
   * @constructor
   */
  private constructor(state: ApiTokenState) {
    this.state = state;
  }
  // #endregion

  // #region Methods
  /**
   * Method create
   *
   * @description
   * The token a session creates at `now`, at version 1, never used.
   *
   * @param {ApiTokenRequest} request - The organization, the user, the name, the scopes, the
   * lifetime and the prefix of the secret.
   * @param {Date} now - When the token is created.
   * @returns {ApiTokenDraft} The token to store.
   * @throws {InvalidApiTokenError} When the name, the scopes or the prefix break a rule.
   */
  public static create(request: ApiTokenRequest, now: Date): ApiTokenDraft {
    const name: string = request.name.trim();
    const length: number = Array.from(name).length;
    if (length === 0 || length > ApiToken.NAME_MAX_LENGTH) {
      throw new InvalidApiTokenError('the name has 1 to 100 characters once trimmed');
    }
    const scopes: readonly string[] = [...new Set(request.scopes)];
    if (scopes.length === 0 || scopes.some((scope: string) => !API_TOKEN_SCOPES.includes(scope))) {
      throw new InvalidApiTokenError('the scopes are known ones, one at least');
    }
    if (!ApiToken.PREFIX_FORMAT.test(request.prefix)) {
      throw new InvalidApiTokenError('the prefix is the start of a secret');
    }
    return {
      organizationId: request.organizationId,
      userId: request.userId,
      name,
      prefix: request.prefix,
      scopes,
      createdAt: now,
      expiresAt: ApiToken.expiryOf(request.expiration, now),
      lastUsedAt: null,
      revokedAt: null,
      version: 1,
    };
  }

  /**
   * Method restore
   *
   * @description
   * Rebuilds a stored token.
   *
   * @param {ApiTokenState} state - The stored state.
   * @returns {ApiToken} The token.
   * @throws {InvalidApiTokenError} When the version is not a positive integer.
   */
  public static restore(state: ApiTokenState): ApiToken {
    if (!Number.isInteger(state.version) || state.version < 1) {
      throw new InvalidApiTokenError('the version is a positive integer');
    }
    return new ApiToken(state);
  }

  /**
   * Method expiryOf
   *
   * @description
   * When a token created at `now` with this lifetime expires.
   *
   * @param {ApiTokenExpiration} expiration - The lifetime.
   * @param {Date} now - The creation.
   * @returns {Date | null} The expiry, or `null` for `never`.
   */
  private static expiryOf(expiration: ApiTokenExpiration, now: Date): Date | null {
    switch (expiration) {
      case '30-days':
        return new Date(now.getTime() + 30 * DAY_MS);
      case '90-days':
        return new Date(now.getTime() + 90 * DAY_MS);
      case '1-year': {
        const expiry: Date = new Date(now.getTime());
        expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
        return expiry;
      }
      case 'never':
        return null;
    }
  }

  /**
   * Method belongsTo
   *
   * @description
   * Whether the token is one of this user in this organization.
   *
   * @param {string} userId - The user.
   * @param {string} organizationId - The organization.
   * @returns {boolean} Whether it is.
   */
  public belongsTo(userId: string, organizationId: string): boolean {
    return this.state.userId === userId && this.state.organizationId === organizationId;
  }

  /**
   * Method isActiveAt
   *
   * @description
   * Whether the token is neither revoked nor expired at `now`.
   *
   * @param {Date} now - The instant of the check.
   * @returns {boolean} Whether it may still be used.
   */
  public isActiveAt(now: Date): boolean {
    return (
      this.state.revokedAt === null &&
      (this.state.expiresAt === null || now.getTime() < this.state.expiresAt.getTime())
    );
  }

  /**
   * Method revoke
   *
   * @description
   * Revokes the token with the next version; a token already revoked is returned as it is.
   *
   * @param {Date} now - When the token is revoked.
   * @returns {ApiToken} The revoked token, or this one when it already was.
   */
  public revoke(now: Date): ApiToken {
    if (this.state.revokedAt !== null) {
      return this;
    }
    return new ApiToken({ ...this.state, revokedAt: now, version: this.state.version + 1 });
  }

  /**
   * Method recordUse
   *
   * @description
   * Records a use at `now`, unless the recorded one is less than a minute old.
   *
   * @param {Date} now - The instant of the use.
   * @returns {ApiToken} The token to store, or this one when nothing changes.
   */
  public recordUse(now: Date): ApiToken {
    const last: Date | null = this.state.lastUsedAt;
    if (last !== null && now.getTime() - last.getTime() < ApiToken.USE_RESOLUTION_MS) {
      return this;
    }
    return new ApiToken({ ...this.state, lastUsedAt: now });
  }
  // #endregion
}
