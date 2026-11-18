import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import users from '../accounts/user.schema.js';

/**
 * Table `security_keys`: the WebAuthn credentials of an account (migration 0005), 10 at most. Each
 * keeps what a later passkey sign-in needs without a migration: the credential id (base64url,
 * unique across accounts), its COSE public key (base64url), its signature counter, its transports
 * and its flags (backup eligibility, backup state, user verification at the registration). `name`
 * is the name the person gave it. No `organization_id`, no policy.
 */
export default pgTable(
  'security_keys',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    credentialId: text('credential_id').notNull(),
    publicKey: text('public_key').notNull(),
    counter: bigint('counter', { mode: 'number' }).notNull().default(0),
    transports: text('transports')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    backupEligible: boolean('backup_eligible').notNull(),
    backedUp: boolean('backed_up').notNull(),
    userVerified: boolean('user_verified').notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('security_keys_credential_id_unique').on(table.credentialId),
    index('security_keys_user_id_index').on(table.userId),
    check('security_keys_counter_check', sql`${table.counter} >= 0`),
  ],
);
