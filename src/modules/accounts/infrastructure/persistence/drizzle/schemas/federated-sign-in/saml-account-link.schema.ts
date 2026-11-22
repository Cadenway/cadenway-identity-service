import { organizationPolicy } from '@cadenway/nest-common/database';
import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import users from '../accounts/user.schema.js';

/** A SAML subject is linked within one organization's configured trust connection. */
export const samlAccountLinks = pgTable(
  'saml_account_links',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').notNull(),
    connectionId: text('connection_id').notNull(),
    issuer: text('issuer').notNull(),
    subject: text('subject').notNull(),
    identityHash: text('identity_hash').notNull(),
    status: text('status').$type<'active' | 'revoked'>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('saml_account_links_scoped_identity_unique').on(
      table.organizationId,
      table.connectionId,
      table.identityHash,
    ),
    index('saml_account_links_user_id_index').on(table.userId),
    check('saml_account_links_hash_check', sql`${table.identityHash} ~ '^[0-9a-f]{64}$'`),
    check('saml_account_links_status_check', sql`${table.status} in ('active', 'revoked')`),
    organizationPolicy('saml_account_links_organization_isolation'),
  ],
);
