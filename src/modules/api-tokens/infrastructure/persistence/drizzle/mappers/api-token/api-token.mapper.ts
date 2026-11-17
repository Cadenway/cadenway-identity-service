import { ApiToken } from '../../../../../domain/aggregates/api-token/api-token.aggregate.js';
import type apiTokens from '../../schemas/api-token/api-token.schema.js';

/**
 * Type ApiTokenRow
 *
 * @description
 * A row of `api_tokens`.
 *
 * @type {typeof apiTokens.$inferSelect}
 */
export type ApiTokenRow = typeof apiTokens.$inferSelect;

/**
 * Function toApiToken
 *
 * @description
 * Maps a row to the token it stores; the hash of the secret stays in the row.
 *
 * @param {ApiTokenRow} row - The row.
 * @returns {ApiToken} The token.
 */
export function toApiToken(row: ApiTokenRow): ApiToken {
  return ApiToken.restore({
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    name: row.name,
    prefix: row.prefix,
    scopes: row.scopes,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
    version: row.version,
  });
}
