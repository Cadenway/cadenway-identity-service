import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import type { FederatedSignInFlowState } from '../../../../../domain/aggregates/federated-sign-in/federated-sign-in-flow.aggregate.js';

/** Browser-bound sign-in attempts. Access is by a digest in a system transaction. */
export const federatedSignInFlows = pgTable(
  'federated_sign_in_flows',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    stateHash: text('state_hash').notNull(),
    receiptHash: text('receipt_hash'),
    state: jsonb('state').$type<FederatedSignInFlowState>().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('federated_sign_in_flows_state_hash_unique').on(table.stateHash),
    uniqueIndex('federated_sign_in_flows_receipt_hash_unique').on(table.receiptHash),
    index('federated_sign_in_flows_expires_at_index').on(table.expiresAt, table.id),
    check('federated_sign_in_flows_state_hash_check', sql`${table.stateHash} ~ '^[0-9a-f]{64}$'`),
    check(
      'federated_sign_in_flows_receipt_hash_check',
      sql`${table.receiptHash} is null or ${table.receiptHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check('federated_sign_in_flows_version_check', sql`${table.version} > 0`),
  ],
);
