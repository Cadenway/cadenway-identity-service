import { organizationPolicy } from '@cadenway/nest-common/database';
import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/** Expiring digests of authenticated SAML assertion IDs, scoped to their tenant and connection. */
export const samlAssertionReplays = pgTable(
  'saml_assertion_replays',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    organizationId: uuid('organization_id').notNull(),
    connectionId: text('connection_id').notNull(),
    keyHash: text('key_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('saml_assertion_replays_scope_key_unique').on(
      table.organizationId,
      table.connectionId,
      table.keyHash,
    ),
    index('saml_assertion_replays_scope_expiry_index').on(
      table.organizationId,
      table.connectionId,
      table.expiresAt,
    ),
    index('saml_assertion_replays_expiry_index').on(table.expiresAt, table.id),
    check('saml_assertion_replays_key_hash_check', sql`${table.keyHash} ~ '^[0-9a-f]{64}$'`),
    organizationPolicy('saml_assertion_replays_organization_isolation'),
  ],
);
