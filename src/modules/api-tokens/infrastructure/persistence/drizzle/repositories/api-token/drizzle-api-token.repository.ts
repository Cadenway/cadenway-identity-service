import type { TransactionDatabase } from '@cadenway/nest-common/database';
import { and, desc, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import type { ApiTokenPosition } from '../../../../../application/models/api-token/api-token-position.model.js';
import type { ApiTokenRepository } from '../../../../../application/ports/outbound/persistence/api-token/api-token-repository.port.js';
import type { ApiToken } from '../../../../../domain/aggregates/api-token/api-token.aggregate.js';
import type { ApiTokenDraft } from '../../../../../domain/value-objects/api-token/api-token-draft.value-object.js';
import { toApiToken } from '../../mappers/api-token/api-token.mapper.js';
import type { ApiTokenRow } from '../../mappers/api-token/api-token.mapper.js';
import apiTokens from '../../schemas/api-token/api-token.schema.js';

/**
 * Class DrizzleApiTokenRepository
 *
 * @description
 * `ApiTokenRepository` on the `api_tokens` table, in the transaction of its unit of work. The
 * queries of a session name the organization and the user, first in the index of the list; the
 * introspection names the token by the unique hash of its secret.
 */
export class DrizzleApiTokenRepository implements ApiTokenRepository {
  // #region Properties
  /**
   * Property db
   *
   * @description
   * The Drizzle database of the transaction.
   *
   * @type {TransactionDatabase}
   * @readonly
   */
  private readonly db: TransactionDatabase;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the repository to a transaction.
   *
   * @param {TransactionDatabase} db - The Drizzle database of the transaction.
   * @constructor
   */
  public constructor(db: TransactionDatabase) {
    this.db = db;
  }
  // #endregion

  // #region Methods
  /**
   * Method insert
   *
   * @description
   * Inserts a new token and reads back the id PostgreSQL assigned.
   *
   * @param {ApiTokenDraft} draft - The token.
   * @param {string} tokenHash - SHA-256 of its secret.
   * @returns {Promise<ApiToken>} The stored token.
   * @throws {Error} When PostgreSQL returns no row, which never happens for a successful insert.
   */
  public async insert(draft: ApiTokenDraft, tokenHash: string): Promise<ApiToken> {
    const rows: ApiTokenRow[] = await this.db
      .insert(apiTokens)
      .values({
        organizationId: draft.organizationId,
        userId: draft.userId,
        name: draft.name,
        prefix: draft.prefix,
        tokenHash,
        scopes: [...draft.scopes],
        expiresAt: draft.expiresAt,
        lastUsedAt: draft.lastUsedAt,
        revokedAt: draft.revokedAt,
        version: draft.version,
        createdAt: draft.createdAt,
        updatedAt: draft.createdAt,
      })
      .returning();
    const row: ApiTokenRow | undefined = rows[0];
    if (row === undefined) {
      throw new Error('The insert of an API token returned no row.');
    }
    return toApiToken(row);
  }

  /**
   * Method listActive
   *
   * @description
   * Reads the tokens neither revoked nor expired of a user in an organization, the most recently
   * created first, strictly after a position.
   *
   * @param {string} organizationId - The organization.
   * @param {string} userId - The user.
   * @param {Date} now - The instant of the list.
   * @param {ApiTokenPosition | null} after - Where the page starts, or `null`.
   * @param {number} count - How many tokens to read at most.
   * @returns {Promise<ApiToken[]>} The tokens.
   */
  public async listActive(
    organizationId: string,
    userId: string,
    now: Date,
    after: ApiTokenPosition | null,
    count: number,
  ): Promise<ApiToken[]> {
    const conditions: (SQL | undefined)[] = [
      eq(apiTokens.organizationId, organizationId),
      eq(apiTokens.userId, userId),
      isNull(apiTokens.revokedAt),
      or(isNull(apiTokens.expiresAt), gt(apiTokens.expiresAt, now)),
    ];
    if (after !== null) {
      conditions.push(
        or(
          lt(apiTokens.createdAt, after.createdAt),
          and(eq(apiTokens.createdAt, after.createdAt), lt(apiTokens.id, after.id)),
        ),
      );
    }
    const rows: ApiTokenRow[] = await this.db
      .select()
      .from(apiTokens)
      .where(and(...conditions))
      .orderBy(desc(apiTokens.createdAt), desc(apiTokens.id))
      .limit(count);
    return rows.map(toApiToken);
  }

  /**
   * Method lock
   *
   * @description
   * Loads and locks a token of an organization by its id.
   *
   * @param {string} organizationId - The organization.
   * @param {string} id - The token.
   * @returns {Promise<ApiToken | null>} The token, or `null`.
   */
  public async lock(organizationId: string, id: string): Promise<ApiToken | null> {
    const rows: ApiTokenRow[] = await this.db
      .select()
      .from(apiTokens)
      .where(and(eq(apiTokens.organizationId, organizationId), eq(apiTokens.id, id)))
      .limit(1)
      .for('update');
    const row: ApiTokenRow | undefined = rows[0];
    return row === undefined ? null : toApiToken(row);
  }

  /**
   * Method revoke
   *
   * @description
   * Writes the revocation and the version of a locked token.
   *
   * @param {ApiToken} token - The revoked token.
   * @returns {Promise<void>} Resolves once written.
   * @throws {Error} When no row has the previous version.
   */
  public async revoke(token: ApiToken): Promise<void> {
    const { organizationId, revokedAt, version } = token.snapshot;
    const updated: { id: string }[] = await this.db
      .update(apiTokens)
      .set({ revokedAt, version, updatedAt: sql`now()` })
      .where(
        and(
          eq(apiTokens.organizationId, organizationId),
          eq(apiTokens.id, token.id),
          eq(apiTokens.version, version - 1),
        ),
      )
      .returning({ id: apiTokens.id });
    if (updated.length !== 1) {
      throw new Error('The API token changed since it was loaded.');
    }
  }

  /**
   * Method findByTokenHash
   *
   * @description
   * Loads the token of a secret hash.
   *
   * @param {string} tokenHash - SHA-256 of the presented secret.
   * @returns {Promise<ApiToken | null>} The token, or `null`.
   */
  public async findByTokenHash(tokenHash: string): Promise<ApiToken | null> {
    const rows: ApiTokenRow[] = await this.db
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.tokenHash, tokenHash))
      .limit(1);
    const row: ApiTokenRow | undefined = rows[0];
    return row === undefined ? null : toApiToken(row);
  }

  /**
   * Method recordUse
   *
   * @description
   * Moves the last use forward; a concurrent introspection that wrote a later one wins.
   *
   * @param {ApiToken} token - The token after the use.
   * @returns {Promise<void>} Resolves once written.
   */
  public async recordUse(token: ApiToken): Promise<void> {
    const { lastUsedAt } = token.snapshot;
    if (lastUsedAt === null) {
      return;
    }
    await this.db
      .update(apiTokens)
      .set({ lastUsedAt })
      .where(
        and(
          eq(apiTokens.id, token.id),
          or(isNull(apiTokens.lastUsedAt), lt(apiTokens.lastUsedAt, lastUsedAt)),
        ),
      );
  }
  // #endregion
}
