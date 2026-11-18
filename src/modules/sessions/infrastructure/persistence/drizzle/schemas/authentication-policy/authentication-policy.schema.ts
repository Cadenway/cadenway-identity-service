import { organizationPolicy } from '@cadenway/nest-common/database';
import { sql } from 'drizzle-orm';
import { check, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Table `authentication_policies`: the authentication policy of an organization ("Politique
 * d'authentification", decision 8 of P2c, migration 0005), keyed by the organization. An
 * organization without a row has the default policy: `nobody`, 720 minutes, version 1; the first
 * change that moves something inserts its row with version 2. `two_step_verification_required_for`
 * names the roles that must have two-step verification (`admins` are the owner and the admins);
 * `session_inactivity_timeout_minutes` the inactivity after which the sessions acting on the
 * organization close. Both are `text` or `integer` with a `CHECK` on the values of the contract,
 * widened by a migration when it adds one. A tenant table: `organization_id` carries the policy of
 * the kit, forced by hand in the migration; the module reads it by organization in system
 * transactions (both introspections, the choice of an organization, the requirements of an
 * account) and reads and writes it in the tenant transaction of the policy routes.
 */
export default pgTable(
  'authentication_policies',
  {
    organizationId: uuid('organization_id').primaryKey(),
    twoStepVerificationRequiredFor: text('two_step_verification_required_for')
      .notNull()
      .default('nobody'),
    sessionInactivityTimeoutMinutes: integer('session_inactivity_timeout_minutes')
      .notNull()
      .default(720),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'authentication_policies_required_for_check',
      sql`${table.twoStepVerificationRequiredFor} in ('nobody', 'admins', 'everyone')`,
    ),
    check(
      'authentication_policies_inactivity_check',
      sql`${table.sessionInactivityTimeoutMinutes} in (60, 720, 10080, 43200)`,
    ),
    check('authentication_policies_version_check', sql`${table.version} >= 1`),
    organizationPolicy('authentication_policies_organization_isolation'),
  ],
);
