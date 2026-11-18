import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Table `two_step_enrollments`: the accounts that have two-step verification, one row each while it
 * is on (migration 0005). The accounts module owns the factors and writes this row in the
 * transaction that turns two-step verification on or off (`RecordTwoStepVerification`); the
 * sessions module reads it for every rule that depends on it: the recent authentication, the
 * withheld organization of both introspections, the choice of an organization and the policy
 * change. `user_id` names an account of the accounts module without a foreign key. No `id` and no
 * `version`: the account is the key and the aggregate. No `organization_id`, no policy.
 */
export default pgTable('two_step_enrollments', {
  userId: uuid('user_id').primaryKey(),
  enabledAt: timestamp('enabled_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
