import { OneTimeCode } from '../../../../../domain/aggregates/one-time-codes/one-time-code.aggregate.js';
import type oneTimeCodes from '../../schemas/authentication/one-time-code.schema.js';

/**
 * Type OneTimeCodeRow
 *
 * @description
 * A row of `one_time_codes`.
 *
 * @type {typeof oneTimeCodes.$inferSelect}
 */
export type OneTimeCodeRow = typeof oneTimeCodes.$inferSelect;

/**
 * Function toOneTimeCode
 *
 * @description
 * Maps a row to the code it stores.
 *
 * @param {OneTimeCodeRow} row - The row.
 * @returns {OneTimeCode} The code.
 */
export function toOneTimeCode(row: OneTimeCodeRow): OneTimeCode {
  return OneTimeCode.restore({
    id: row.id,
    userId: row.userId,
    purpose: row.purpose,
    codeHash: row.codeHash,
    expiresAt: row.expiresAt,
    failedAttempts: row.failedAttempts,
    consumedAt: row.consumedAt,
    replacedAt: row.replacedAt,
  });
}
