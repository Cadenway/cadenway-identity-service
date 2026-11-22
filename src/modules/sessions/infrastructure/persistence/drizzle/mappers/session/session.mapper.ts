import { Session } from '../../../../../domain/aggregates/session/session.aggregate.js';
import type sessions from '../../schemas/session/session.schema.js';

/**
 * Type SessionRow
 *
 * @description
 * A row of `sessions`, with the inactivity of the policy of the organization it names, which the
 * repository reads with it (720 minutes without one).
 *
 * @type {typeof sessions.$inferSelect & { readonly inactivityTimeoutMinutes: number }}
 */
export type SessionRow = typeof sessions.$inferSelect & {
  readonly inactivityTimeoutMinutes: number;
};

/**
 * Function toSession
 *
 * @description
 * Maps a row to the session it stores; the token hash and the browser stay in the row. A method
 * other than the two of the check constraint cannot be stored.
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
    organizationId: row.organizationId,
    memberId: row.memberId,
    samlMembership:
      row.samlOrganizationId === null || row.samlMemberId === null
        ? null
        : { organizationId: row.samlOrganizationId, memberId: row.samlMemberId },
    version: row.version,
    signedInAt: row.signedInAt,
    authenticatedAt: row.authenticatedAt,
    twoStepAuthenticatedAt: row.twoStepAuthenticatedAt,
    inactivityTimeoutMinutes: row.inactivityTimeoutMinutes,
  });
}
