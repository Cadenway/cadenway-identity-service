import { Membership } from '../../../../../domain/aggregates/membership/membership.aggregate.js';
import type { MemberRole } from '../../../../../domain/value-objects/membership/member-role.value-object.js';
import type memberships from '../../schemas/membership/membership.schema.js';

/**
 * Type MembershipRow
 *
 * @description
 * A row of `memberships`.
 *
 * @type {typeof memberships.$inferSelect}
 */
export type MembershipRow = typeof memberships.$inferSelect;

/**
 * Function toMembership
 *
 * @description
 * Maps a row to the membership it stores. The role is trusted: the `CHECK` constraint of the table
 * admits the four roles only.
 *
 * @param {MembershipRow} row - The row.
 * @returns {Membership} The membership.
 */
export function toMembership(row: MembershipRow): Membership {
  return Membership.restore({
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    role: row.role as MemberRole,
    version: row.version,
    removedAt: row.removedAt,
  });
}
