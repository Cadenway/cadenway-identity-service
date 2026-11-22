import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Table `code_requests`: the throttle of the code requests, one row per normalized address, whatever
 * the purpose and whether or not an account uses the address, so the throttle never tells. The
 * address is the key, hence no `id` column. Locking the row serializes the code requests and
 * sign-ups of one address. `last_requested_at` is `null` for a row created only to hold the lock of
 * a request that was then refused; `window_started_at` and `window_requests` count the requests of
 * the current hour, 5 at most. No organization, no row-level security policy.
 */
export default pgTable(
  'code_requests',
  {
    email: text('email').primaryKey(),
    lastRequestedAt: timestamp('last_requested_at', { withTimezone: true }),
    windowStartedAt: timestamp('window_started_at', { withTimezone: true }),
    windowRequests: integer('window_requests').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('code_requests_retention_index').on(table.updatedAt, table.email),
    check('code_requests_window_requests_check', sql`${table.windowRequests} between 0 and 5`),
  ],
);
