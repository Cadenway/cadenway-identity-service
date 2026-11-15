import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import users from './user.schema.js';

/**
 * Table `password_credentials`: the password of each account, as its encoded argon2id hash (algorithm,
 * parameters, salt and hash; the pepper never is). One row per account, removed with the account. No
 * organization, no row-level security policy.
 */
export default pgTable('password_credentials', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
