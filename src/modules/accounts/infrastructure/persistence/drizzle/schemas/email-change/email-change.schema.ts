import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import users from '../accounts/user.schema.js';

/**
 * Table `email_changes`: the pending change of address of each account, one at most, keyed by the
 * account and going with it (migration 0004). `session_id` names the session that asked for it, a
 * session of the sessions module, without a foreign key: a module never references the tables of
 * another. `email` is the new address, normalized. No `organization_id`, no policy.
 */
export default pgTable('email_changes', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id').notNull(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
