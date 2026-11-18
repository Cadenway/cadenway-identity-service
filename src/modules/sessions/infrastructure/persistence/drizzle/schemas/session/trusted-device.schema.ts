import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * Table `trusted_devices`: the browsers an account trusts for 30 days ("Faire confiance à cet
 * appareil pendant 30 jours", decision 7 of P2c, migration 0005), whose sign-ins skip the two-step
 * challenge. The token of the cookie `__Host-cw_trusted_device` is never stored: `token_hash` is its
 * SHA-256, unique. `user_id` names an account of the accounts module without a foreign key. A
 * password change or reset, the revocation of the other sessions, turning two-step verification off
 * and scheduling the deletion delete every row of the account. No `version`: a trusted device never
 * changes. No `organization_id`, no policy.
 */
export default pgTable(
  'trusted_devices',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('trusted_devices_token_hash_unique').on(table.tokenHash),
    index('trusted_devices_user_id_index').on(table.userId),
  ],
);
