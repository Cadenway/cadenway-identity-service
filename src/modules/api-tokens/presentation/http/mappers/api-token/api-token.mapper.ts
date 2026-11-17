import type { ApiToken } from '@cadenway/contracts/types/internal/identity-service';

import type { ApiTokenView } from '../../../../application/projections/api-token/api-token-view.projection.js';

/**
 * Function toApiToken
 *
 * @description
 * Maps a token to `ApiToken` of the contract, dates in ISO 8601. It never holds the secret.
 *
 * @param {ApiTokenView} view - The token.
 * @returns {ApiToken} The body of the token.
 */
export function toApiToken(view: ApiTokenView): ApiToken {
  return {
    id: view.id,
    name: view.name,
    prefix: view.prefix,
    scopes: [...view.scopes],
    organizationId: view.organizationId,
    createdAt: view.createdAt.toISOString(),
    expiresAt: view.expiresAt?.toISOString() ?? null,
    lastUsedAt: view.lastUsedAt?.toISOString() ?? null,
  };
}
