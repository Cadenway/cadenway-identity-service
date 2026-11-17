import { organizationPolicy } from '@cadenway/nest-common/database';
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
 * `organization_id` is the current organization of the session and `member_id` the membership it
 * acts through (a `memberId` of the memberships module), both `null` without one (migration
 * 0003). The column carries the policy of the kit, enabled and forced, as every `organization_id`
 * does; every query of the module runs in a system transaction and names its session by id or token
 * hash, but the check of the recent authentication of a request that carries an organization, which
 * joins its tenant transaction. `signed_in_at` is the sign-in that opened the session, set by the
 * service to the millisecond so the cursor of the list is exact, and `authenticated_at` the last time
 * its person proved who they are (migration 0004, which backfills `signed_in_at` from `created_at`
 * for the sessions not revoked or expired and leaves `authenticated_at` empty, so a session opened
 * before asks for the password again).
 * `browser`, `operating_system` and `device_type` are written for the record only: the list reads the
 * device from `user_agent`.
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
    organizationId: uuid('organization_id'),
    memberId: uuid('member_id'),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    signedInAt: timestamp('signed_in_at', { withTimezone: true })
      .notNull()
      .default(sql`date_trunc('milliseconds', now())`),
    authenticatedAt: timestamp('authenticated_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
    index('sessions_user_id_index').on(table.userId),
    check('sessions_version_check', sql`${table.version} >= 1`),
    check(
      'sessions_membership_check',
      sql`(${table.organizationId} is null) = (${table.memberId} is null)`,
    ),
    organizationPolicy('sessions_organization_isolation'),
  ],
);
