import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Table `sessions`: the sign-in sessions. The token is never stored: `token_hash` is its SHA-256,
 * unique, the key of every introspection. `user_id` names an account of the accounts module without
 * a foreign key, since a module never references the tables of another. The address and
 * `User-Agent` of the browser, and the device read from it, are kept to show the session later.
 * A session belongs to no organization yet: no `organization_id`, no row-level security policy.
 */
export default pgTable(
  'sessions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    persistent: boolean('persistent').notNull(),
    ipAddress: text('ip_address').notNull(),
    userAgent: text('user_agent'),
    browser: text('browser'),
    operatingSystem: text('operating_system'),
    deviceType: text('device_type'),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
    index('sessions_user_id_index').on(table.userId),
    check('sessions_version_check', sql`${table.version} >= 1`),
  ],
);
