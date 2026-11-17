import { organizationPolicy } from '@cadenway/nest-common/database';
import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Table `organization_choices`: the last organization each account chose with
 * `PUT /internal/v1/sessions/{sessionId}/organization`, where its next sessions start when the
 * account is still a member there (P2b plan, decision 2). One row per account, keyed by `user_id`,
 * an account of the accounts module named without a foreign key. `organization_id` carries the
 * policy of the kit, enabled and forced, as every `organization_id` does; the module reads and
 * writes it in system transactions, by account. The organization is kept, not the membership: a
 * person who joined that organization again starts there.
 */
export default pgTable(
  'organization_choices',
  {
    userId: uuid('user_id').primaryKey(),
    organizationId: uuid('organization_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  () => [organizationPolicy('organization_choices_organization_isolation')],
);
