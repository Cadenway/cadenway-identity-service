import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import users from '../accounts/user.schema.js';

/**
 * Table `backup_codes`: the 10 backup codes of an account with two-step verification (migration
 * 0005), each kept as the HMAC-SHA-256 of the account and the code, under a key derived from the
 * pepper, never in clear. `used_at` marks a code used once; a regeneration deletes the rows of the
 * account and inserts 10 new ones. Unique per account and hash, which is also the index of the
 * lookup of an answer. No `organization_id`, no policy.
 */
export default pgTable(
  'backup_codes',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('backup_codes_user_hash_unique').on(table.userId, table.codeHash)],
);
