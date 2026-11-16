import type { OneTimeCodeState } from './one-time-code-state.aggregate.js';

/**
 * Type OneTimeCodeIssue
 *
 * @description
 * A code to store: PostgreSQL assigns its id on insert.
 *
 * @type {Pick<OneTimeCodeState, 'userId' | 'purpose' | 'codeHash' | 'expiresAt'>}
 */
export type OneTimeCodeIssue = Pick<
  OneTimeCodeState,
  'userId' | 'purpose' | 'codeHash' | 'expiresAt'
>;
