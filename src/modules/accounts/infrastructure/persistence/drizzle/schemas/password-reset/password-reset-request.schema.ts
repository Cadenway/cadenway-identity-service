import { sql } from 'drizzle-orm';
import { check, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Table `password_reset_requests`: the throttle of the password reset requests of each address,
 * account or not, apart from `code_requests` (migration 0004). Keyed by the normalized address, no
 * `organization_id`, no policy.
 */
export default pgTable(
  'password_reset_requests',
  {
    email: text('email').primaryKey(),
    lastRequestedAt: timestamp('last_requested_at', { withTimezone: true }),
    windowStartedAt: timestamp('window_started_at', { withTimezone: true }),
    windowRequests: integer('window_requests').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'password_reset_requests_window_requests_check',
      sql`${table.windowRequests} between 0 and 5`,
    ),
  ],
);
