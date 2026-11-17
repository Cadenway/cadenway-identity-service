import type { ApiTokenState } from './api-token-state.value-object.js';

/**
 * Type ApiTokenDraft
 *
 * @description
 * A token not stored yet: PostgreSQL assigns its id on insert.
 *
 * @type {Omit<ApiTokenState, 'id'>}
 */
export type ApiTokenDraft = Omit<ApiTokenState, 'id'>;
