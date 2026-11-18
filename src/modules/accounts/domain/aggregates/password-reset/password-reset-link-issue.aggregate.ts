import type { PasswordResetLinkState } from './password-reset-link-state.aggregate.js';

/**
 * Type PasswordResetLinkIssue
 *
 * @description
 * A link not stored yet: PostgreSQL assigns its id on insert.
 *
 * @type {Pick<PasswordResetLinkState, 'userId' | 'tokenHash' | 'expiresAt'>}
 */
export type PasswordResetLinkIssue = Pick<
  PasswordResetLinkState,
  'userId' | 'tokenHash' | 'expiresAt'
>;
