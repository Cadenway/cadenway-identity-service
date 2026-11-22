import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Table `sign_in_attempts`: the password lockout of each normalized address, whether or not an account
 * uses it, so the lockout never tells. The address is the key, hence no `id` column; a success
 * sets the count back to zero and keeps the row. Locking the row serializes the password sign-ins
 * of one address. No organization, no row-level security policy.
 */
export default pgTable(
  'sign_in_attempts',
  {
    email: text('email').primaryKey(),
    failedAttempts: integer('failed_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sign_in_attempts_retention_index').on(table.updatedAt, table.email),
    check('sign_in_attempts_failed_attempts_check', sql`${table.failedAttempts} between 0 and 5`),
  ],
);
