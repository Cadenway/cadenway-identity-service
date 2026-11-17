import type { ApiToken } from '../../../domain/aggregates/api-token/api-token.aggregate.js';
import type { ApiTokenView } from '../../projections/api-token/api-token-view.projection.js';

/**
 * Function toApiTokenView
 *
 * @description
 * Maps a token to its view, which never holds its secret nor its hash.
 *
 * @param {ApiToken} token - The token.
 * @returns {ApiTokenView} Its view.
 */
export function toApiTokenView(token: ApiToken): ApiTokenView {
  const { id, name, prefix, scopes, organizationId, createdAt, expiresAt, lastUsedAt } =
    token.snapshot;
  return { id, name, prefix, scopes, organizationId, createdAt, expiresAt, lastUsedAt };
}
