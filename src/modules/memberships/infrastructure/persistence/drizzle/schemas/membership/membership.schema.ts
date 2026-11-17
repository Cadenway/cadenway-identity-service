import { organizationPolicy } from '@cadenway/nest-common/database';
import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Table `memberships`: the copy of the memberships of organization-service, fed by
 * `member.joined.v1`, `member.role-changed.v1` and `member.removed.v1`. `id` is the `memberId` of
 * organization-service, not an id of this service: a projection keeps the id its owner gave.
 * `version` is the highest version of the membership applied; `removed_at` marks a membership that
 * ended, kept so that a late event never brings it back. A tenant table: `organization_id` carries
 * the policy of the kit, forced by hand in the migration, and leads the index of the reads by
 * organization and account.
 */
export default pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey(),
    organizationId: uuid('organization_id').notNull(),
    userId: uuid('user_id').notNull(),
    role: text('role').notNull(),
    version: integer('version').notNull(),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('memberships_organization_user_index').on(table.organizationId, table.userId),
    check('memberships_role_check', sql`${table.role} in ('owner', 'admin', 'member', 'guest')`),
    check('memberships_version_check', sql`${table.version} >= 1`),
    organizationPolicy('memberships_organization_isolation'),
  ],
);
