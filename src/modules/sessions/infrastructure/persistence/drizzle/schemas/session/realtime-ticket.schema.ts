import { organizationPolicy } from '@cadenway/nest-common/database';
import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import sessions from './session.schema.js';

/**
 * A session-bound, single-use credential. Only the SHA-256 digest is stored. The system
 * transaction finds a ticket by its unique digest, then verifies the session and membership.
 */
export default pgTable(
  'realtime_tickets',
  {
    tokenHash: text('token_hash').primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    organizationId: uuid('organization_id').notNull(),
    memberId: uuid('member_id').notNull(),
    sessionVersion: integer('session_version').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true, precision: 3 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, precision: 3 }).notNull(),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true, precision: 3 }),
  },
  (table) => [
    index('realtime_tickets_session_id_index').on(table.sessionId),
    index('realtime_tickets_expiry_index').on(table.expiresAt, table.tokenHash),
    check('realtime_tickets_token_hash_check', sql`${table.tokenHash} ~ '^[a-f0-9]{64}$'`),
    check('realtime_tickets_session_version_check', sql`${table.sessionVersion} >= 1`),
    check(
      'realtime_tickets_lifetime_check',
      sql`${table.expiresAt} > ${table.issuedAt} and ${table.expiresAt} <= ${table.issuedAt} + interval '60 seconds'`,
    ),
    check(
      'realtime_tickets_redeemed_at_check',
      sql`${table.redeemedAt} is null or (${table.redeemedAt} >= ${table.issuedAt} and ${table.redeemedAt} < ${table.expiresAt})`,
    ),
    organizationPolicy('realtime_tickets_organization_isolation'),
  ],
);
