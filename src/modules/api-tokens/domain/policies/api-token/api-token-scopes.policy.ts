/**
 * Constant API_TOKEN_SCOPES
 *
 * @description
 * The scopes a personal API token can be given ("Portées" of the mockup's "Créer un jeton";
 * `ApiTokenScope` of `openapi/public/api-tokens.yaml`, P2b plan, decision 6): `tasks:read`,
 * `tasks:write`, `members:read` and `webhooks:manage`. A spec compares them with the installed
 * contract, so that a scope added there is added here, and to the `CHECK` of `api_tokens.scopes`
 * by a migration, in the same change.
 *
 * @type {readonly string[]}
 */
export const API_TOKEN_SCOPES: readonly string[] = Object.freeze([
  'tasks:read',
  'tasks:write',
  'members:read',
  'webhooks:manage',
]);
