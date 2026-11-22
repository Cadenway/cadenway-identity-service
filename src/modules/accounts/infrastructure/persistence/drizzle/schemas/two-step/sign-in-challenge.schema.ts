import { sql } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import users from '../accounts/user.schema.js';

/**
 * Table `sign_in_challenges`: the open two-step challenge of an account, one at most (migration
 * 0005): a sign-in whose first factor is right replaces it, its right answer deletes it. It is
 * valid 10 minutes and known by the SHA-256 of its token (256 random bits), never in clear.
 * `persistent` keeps the `rememberMe` of the sign-in for the session its answer opens;
 * `assertion_challenge` and `assertion_expires_at` are the WebAuthn challenge of its latest
 * security-key options, valid 5 minutes. No `organization_id`, no policy.
 */
export default pgTable(
  'sign_in_challenges',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    persistent: boolean('persistent').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    federatedBinding: jsonb('federated_binding'),
    assertionChallenge: text('assertion_challenge'),
    assertionExpiresAt: timestamp('assertion_expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('sign_in_challenges_user_id_unique').on(table.userId),
    uniqueIndex('sign_in_challenges_token_hash_unique').on(table.tokenHash),
  ],
);
