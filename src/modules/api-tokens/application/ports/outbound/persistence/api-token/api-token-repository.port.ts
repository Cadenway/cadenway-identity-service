import type { ApiToken } from '../../../../../domain/aggregates/api-token/api-token.aggregate.js';
import type { ApiTokenDraft } from '../../../../../domain/value-objects/api-token/api-token-draft.value-object.js';
import type { ApiTokenPosition } from '../../../../models/api-token/api-token-position.model.js';

/**
 * Interface ApiTokenRepository
 *
 * @description
 * The personal API tokens, bound to the transaction of a unit of work. The routes of a session run
 * in the tenant transaction of its organization and name it in every query; the introspection runs
 * in a system transaction and names the token by the hash of its secret.
 */
export interface ApiTokenRepository {
  // #region Methods
  /**
   * Method insert
   *
   * @description
   * Stores a new token with the hash of its secret; PostgreSQL assigns its id.
   *
   * @param {ApiTokenDraft} draft - The token.
   * @param {string} tokenHash - SHA-256 of its secret.
   * @returns {Promise<ApiToken>} The stored token, with its id.
   */
  insert(draft: ApiTokenDraft, tokenHash: string): Promise<ApiToken>;

  /**
   * Method listActive
   *
   * @description
   * The tokens of a user in an organization that are neither revoked nor expired at `now`, the most
   * recently created first, after a position.
   *
   * @param {string} organizationId - The organization.
   * @param {string} userId - The user.
   * @param {Date} now - The instant of the list.
   * @param {ApiTokenPosition | null} after - Where the page starts, or `null`.
   * @param {number} count - How many tokens to read at most.
   * @returns {Promise<ApiToken[]>} The tokens.
   */
  listActive(
    organizationId: string,
    userId: string,
    now: Date,
    after: ApiTokenPosition | null,
    count: number,
  ): Promise<ApiToken[]>;

  /**
   * Method lock
   *
   * @description
   * Loads a token of an organization by its id and locks it until the end of the transaction.
   *
   * @param {string} organizationId - The organization.
   * @param {string} id - The token.
   * @returns {Promise<ApiToken | null>} The token, or `null`.
   */
  lock(organizationId: string, id: string): Promise<ApiToken | null>;

  /**
   * Method revoke
   *
   * @description
   * Writes the revocation and the version of a token locked by `lock`.
   *
   * @param {ApiToken} token - The revoked token.
   * @returns {Promise<void>} Resolves once written.
   */
  revoke(token: ApiToken): Promise<void>;

  /**
   * Method findByTokenHash
   *
   * @description
   * Loads the token of a secret by its hash, without a lock.
   *
   * @param {string} tokenHash - SHA-256 of the presented secret.
   * @returns {Promise<ApiToken | null>} The token, or `null` for an unknown secret.
   */
  findByTokenHash(tokenHash: string): Promise<ApiToken | null>;

  /**
   * Method recordUse
   *
   * @description
   * Writes the last use of a token, never moving it back.
   *
   * @param {ApiToken} token - The token after the use.
   * @returns {Promise<void>} Resolves once written.
   */
  recordUse(token: ApiToken): Promise<void>;
  // #endregion
}
