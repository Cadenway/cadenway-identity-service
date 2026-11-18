import { sql } from 'drizzle-orm';
import { bigint, check, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import users from '../accounts/user.schema.js';

/**
 * Table `two_step_verifications`: the two-step verification of an account, one row while it is on
 * (decision 7 of P2c, migration 0005), keyed by the account and going with it.
 *
 * - `authenticator_secret` is the TOTP secret of the authenticator app, sealed with AES-256-GCM
 *   under a key derived from the pepper and bound to the account, never in clear;
 *   `last_accepted_time_step` is the time step of the last code accepted, so that a code is
 *   accepted once (`afterTimeStep` of otplib).
 * - `webauthn_user_handle` is the opaque WebAuthn handle of the account (32 random bytes,
 *   base64url), neither its id nor its address, unique.
 * - `failed_answers` and `locked_until` count the wrong answers in a row of its challenges and of
 *   its re-authentication codes: the fifth locks them for 15 minutes.
 * - `backup_codes_generated_at` is when its current backup codes were drawn.
 *
 * No `id` and no `version` of its own: the account is the aggregate, its `users.version` the
 * version of the events. No `organization_id`, no policy.
 */
export default pgTable(
  'two_step_verifications',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    authenticatorSecret: text('authenticator_secret').notNull(),
    authenticatorConfiguredAt: timestamp('authenticator_configured_at', {
      withTimezone: true,
    }).notNull(),
    lastAcceptedTimeStep: bigint('last_accepted_time_step', { mode: 'number' }),
    webauthnUserHandle: text('webauthn_user_handle').notNull().unique(),
    failedAnswers: integer('failed_answers').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    backupCodesGeneratedAt: timestamp('backup_codes_generated_at', {
      withTimezone: true,
    }).notNull(),
    enabledAt: timestamp('enabled_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'two_step_verifications_failed_answers_check',
      sql`${table.failedAnswers} between 0 and 5`,
    ),
  ],
);
