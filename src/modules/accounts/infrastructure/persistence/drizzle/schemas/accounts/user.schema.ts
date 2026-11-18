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

/**
 * Table `users`: the accounts. An account belongs to a person, not to an organization: the table has
 * no `organization_id` and therefore no row-level security policy (see the MODULE.md of the
 * accounts module). `email` holds the trimmed, lowercased address, unique; `email_verified_at` is
 * the verified flag, `null` until a code proves the address; `version` is the version of the
 * aggregate, the `ETag` of `GET /internal/v1/users/{userId}` and the `version` of its events;
 * `sign_up_count` counts the accepted sign-ups of the address for the account, so that its
 * verification requires the password of the latest one once it exceeds 1 (migration 0002).
 * `display_name`, `job_title` and `time_zone` hold the profile of the mockup's "Profil" (migration
 * 0003): `null`, `null` and `Europe/Paris` for an account that never set them.
 * `password_changed_at` is when the password was last set (migration 0004, backfilled from the
 * credential); `delete_at` the end of a scheduled deletion, `null` without one, and
 * `deletion_checked_at` the last check that kept a due deletion because the account owned an
 * organization.
 */
export default pgTable(
  'users',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    email: text('email').notNull(),
    name: text('name').notNull(),
    language: text('language').notNull().default('fr'),
    displayName: text('display_name'),
    jobTitle: text('job_title'),
    timeZone: text('time_zone').notNull().default('Europe/Paris'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
    signUpCount: integer('sign_up_count').notNull().default(1),
    passwordChangedAt: timestamp('password_changed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deleteAt: timestamp('delete_at', { withTimezone: true }),
    deletionCheckedAt: timestamp('deletion_checked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_email_unique').on(table.email),
    index('users_delete_at_index')
      .on(table.deleteAt)
      .where(sql`${table.deleteAt} is not null`),
    check('users_version_check', sql`${table.version} >= 1`),
    check('users_sign_up_count_check', sql`${table.signUpCount} >= 1`),
  ],
);
