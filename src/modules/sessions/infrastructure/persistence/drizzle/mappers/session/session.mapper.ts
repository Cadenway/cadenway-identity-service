import { Session } from '../../../../../domain/aggregates/session/session.aggregate.js';
import type sessions from '../../schemas/session/session.schema.js';

/**
 * Type SessionRow
 *
 * @description
 * A row of `sessions`.
 *
 * @type {typeof sessions.$inferSelect}
 */
export type SessionRow = typeof sessions.$inferSelect;

/**
 * Function toSession
 *
 * @description
 * Maps a row to the session it stores; the token hash and the browser stay in the row.
 *
 * @param {SessionRow} row - The row.
 * @returns {Session} The session.
 */
export function toSession(row: SessionRow): Session {
  return Session.restore({
    id: row.id,
    userId: row.userId,
    persistent: row.persistent,
    lastActiveAt: row.lastActiveAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    version: row.version,
  });
}
