import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import users from '../accounts/user.schema.js';

/**
 * Table `one_time_codes`: the single-use codes sent by email. The code is never stored: `code_hash`
 * is its HMAC-SHA-256, keyed with a key derived from the pepper and bound to the account and the
 * purpose. At most one current code (neither consumed nor replaced) per account and purpose, which
 * the partial unique index enforces. No organization, no row-level security policy.
 */
export default pgTable(
  'one_time_codes',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: text('purpose', { enum: ['email-verification', 'sign-in', 'email-change'] }).notNull(),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    failedAttempts: integer('failed_attempts').notNull().default(0),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    replacedAt: timestamp('replaced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'one_time_codes_purpose_check',
      sql`${table.purpose} in ('email-verification', 'sign-in', 'email-change')`,
    ),
    check('one_time_codes_failed_attempts_check', sql`${table.failedAttempts} between 0 and 5`),
    uniqueIndex('one_time_codes_current_unique')
      .on(table.userId, table.purpose)
      .where(sql`${table.consumedAt} is null and ${table.replacedAt} is null`),
    index('one_time_codes_user_purpose_hash_index').on(table.userId, table.purpose, table.codeHash),
  ],
);
