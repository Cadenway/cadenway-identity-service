import { organizationPolicy } from '@cadenway/nest-common/database';
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
 * Table `api_tokens`: the personal API tokens. The secret is never stored: `token_hash` is its
 * SHA-256, unique, the key of every introspection, and `prefix` its first 11 characters, shown to
 * recognize the token. `user_id` names an account of the accounts module without a foreign key. A
 * tenant table: `organization_id`, the organization the token acts in, carries the policy of the
 * kit, forced by hand in the migration, and leads the index of the list. `scopes` holds the known
 * scopes only, one at least, under a `CHECK` that a new scope widens in a migration.
 */
export default pgTable(
  'api_tokens',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    organizationId: uuid('organization_id').notNull(),
    userId: uuid('user_id').notNull(),
    name: text('name').notNull(),
    prefix: text('prefix').notNull(),
    tokenHash: text('token_hash').notNull(),
    scopes: text('scopes').array().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('api_tokens_token_hash_unique').on(table.tokenHash),
    index('api_tokens_organization_user_created_index').on(
      table.organizationId,
      table.userId,
      table.createdAt,
      table.id,
    ),
    index('api_tokens_user_id_index').on(table.userId),
    check(
      'api_tokens_scopes_check',
      sql`cardinality(${table.scopes}) >= 1 and ${table.scopes} <@ array['tasks:read', 'tasks:write', 'members:read', 'webhooks:manage']::text[]`,
    ),
    check('api_tokens_prefix_check', sql`char_length(${table.prefix}) = 11`),
    check('api_tokens_version_check', sql`${table.version} >= 1`),
    organizationPolicy('api_tokens_organization_isolation'),
  ],
);
