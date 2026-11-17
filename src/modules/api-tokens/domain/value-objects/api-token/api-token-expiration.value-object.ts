/**
 * Type ApiTokenExpiration
 *
 * @description
 * Lifetime of a personal API token, counted from its creation ("Expiration" of the mockup's
 * "Créer un jeton", `ApiTokenCreation.expiration` of `openapi/public/api-tokens.yaml`): 30 days by
 * default, 90 days, 1 year, or never.
 *
 * @type {'30-days' | '90-days' | '1-year' | 'never'}
 */
export type ApiTokenExpiration = '30-days' | '90-days' | '1-year' | 'never';
