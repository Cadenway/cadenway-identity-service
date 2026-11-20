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

import users from '../accounts/user.schema.js';

/** Account-owned upload reservations and their original idempotency binding. */
const avatarUploads = pgTable(
  'avatar_uploads',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    generation: integer('generation').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    status: text('status').notNull(),
    idempotencyDigest: text('idempotency_digest'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('avatar_uploads_user_idempotency_unique').on(table.userId, table.idempotencyDigest),
    index('avatar_uploads_expiry_index')
      .on(table.expiresAt, table.userId, table.id)
      .where(sql`${table.status} = 'pending'`),
    check('avatar_uploads_generation_check', sql`${table.generation} >= 0`),
    check('avatar_uploads_size_check', sql`${table.sizeBytes} between 1 and 5242880`),
    check(
      'avatar_uploads_content_type_check',
      sql`${table.contentType} in ('image/png', 'image/jpeg', 'image/webp')`,
    ),
    check(
      'avatar_uploads_status_check',
      sql`${table.status} in ('pending', 'committed', 'expired', 'superseded')`,
    ),
  ],
);

export default avatarUploads;
