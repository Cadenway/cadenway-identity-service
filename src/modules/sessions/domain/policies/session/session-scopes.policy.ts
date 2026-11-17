/**
 * Constant SESSION_SCOPES
 *
 * @description
 * The scopes a session holds: every scope (P2b plan, decision 7; `ActiveToken.scopes` of
 * `openapi/internal/identity-service.yaml`, "A session holds every scope"). They are the scopes a
 * personal API token can be given (`ApiTokenScope` of the contract); a spec of the HTTP adapter
 * compares the two lists, so that a scope added to the contract is added here in the same change.
 *
 * @type {readonly string[]}
 */
export const SESSION_SCOPES: readonly string[] = Object.freeze([
  'tasks:read',
  'tasks:write',
  'members:read',
  'webhooks:manage',
]);
