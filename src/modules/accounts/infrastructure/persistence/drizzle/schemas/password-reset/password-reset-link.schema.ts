import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import users from '../accounts/user.schema.js';

/**
 * Table `password_reset_links`: the links of "Mot de passe oublié" (migration 0004). A link
 * follows its account (no `organization_id`, no policy) and goes with it. `token_hash` is the
 * SHA-256 of the token, unique: the token itself is never stored. At most one link of an account
 * is current, neither used nor replaced (`password_reset_links_current_unique`).
 */
export default pgTable(
  'password_reset_links',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    replacedAt: timestamp('replaced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('password_reset_links_token_hash_unique').on(table.tokenHash),
    uniqueIndex('password_reset_links_current_unique')
      .on(table.userId)
      .where(sql`${table.usedAt} is null and ${table.replacedAt} is null`),
  ],
);
