import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import type { FederatedConnection } from '../../../../../domain/value-objects/federated-sign-in/federated-connection.value-object.js';
import users from '../accounts/user.schema.js';

/** A provider identity belongs to one Identity account, independently of the organization. */
export const federatedAccountLinks = pgTable(
  'federated_account_links',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').$type<FederatedConnection['provider']>().notNull(),
    issuer: text('issuer').notNull(),
    subject: text('subject').notNull(),
    identityHash: text('identity_hash').notNull(),
    status: text('status').$type<'active' | 'revoked'>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('federated_account_links_identity_hash_unique').on(table.identityHash),
    index('federated_account_links_user_id_index').on(table.userId),
    check(
      'federated_account_links_provider_check',
      sql`${table.provider} in ('google', 'github', 'microsoft', 'gitlab', 'saml')`,
    ),
    check('federated_account_links_hash_check', sql`${table.identityHash} ~ '^[0-9a-f]{64}$'`),
    check('federated_account_links_status_check', sql`${table.status} in ('active', 'revoked')`),
  ],
);
