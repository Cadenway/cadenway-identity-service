import { OneTimeCode } from './one-time-code.aggregate.js';

/**
 * Type OneTimeCodeCheck
 *
 * @description
 * Outcome of checking a candidate against the working code of an account:
 *
 * - `accepted`: the candidate is the code; `code` is the consumed code to store;
 * - `refused`: the candidate is wrong; `code` carries the counted attempt, to store;
 * - `expired`: the code no longer works (expired, used, replaced or too many wrong attempts),
 *   whatever the candidate; nothing changes.
 *
 * @type {{ readonly outcome: 'accepted' | 'refused'; readonly code: OneTimeCode } | { readonly outcome: 'expired' }}
 */
export type OneTimeCodeCheck =
  | { readonly outcome: 'accepted' | 'refused'; readonly code: OneTimeCode }
  | { readonly outcome: 'expired' };
