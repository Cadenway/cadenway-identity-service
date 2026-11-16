import { sql } from 'drizzle-orm';
import { check, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * Table `users`: the accounts. An account belongs to a person, not to an organization: the table has
 * no `organization_id` and therefore no row-level security policy (see the MODULE.md of the
 * accounts module). `email` holds the trimmed, lowercased address, unique; `email_verified_at` is
 * the verified flag, `null` until a code proves the address; `version` is the version of the
 * aggregate, the `ETag` of `GET /internal/v1/users/{userId}` and the `version` of its events;
 * `sign_up_count` counts the accepted sign-ups of the address for the account, so that its
 * verification requires the password of the latest one once it exceeds 1 (migration 0002).
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
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
    signUpCount: integer('sign_up_count').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_email_unique').on(table.email),
    check('users_version_check', sql`${table.version} >= 1`),
    check('users_sign_up_count_check', sql`${table.signUpCount} >= 1`),
  ],
);
