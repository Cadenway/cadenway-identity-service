import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import users from '../accounts/user.schema.js';

/**
 * Table `authenticator_app_setups`: the pending setup of an authenticator app of an account, one at
 * most (migration 0005), valid 15 minutes; a new start replaces it. `secret` is the new TOTP
 * secret, sealed like `two_step_verifications.authenticator_secret`. `session_id` names the
 * session that started it, a session of the sessions module, without a foreign key. No
 * `organization_id`, no policy.
 */
export default pgTable('authenticator_app_setups', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id').notNull(),
  secret: text('secret').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
