import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import users from '../accounts/user.schema.js';

/**
 * Table `security_key_registrations`: the pending registration of a security key of an account,
 * one at most (migration 0005), valid 5 minutes; a new start replaces it. `challenge` is the
 * WebAuthn challenge of its creation options (base64url), single use. `session_id` names the
 * session that started it, without a foreign key. No `organization_id`, no policy.
 */
export default pgTable('security_key_registrations', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id').notNull(),
  challenge: text('challenge').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
