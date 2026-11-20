import { createHash } from 'node:crypto';

import type { TransactionDatabase } from '@cadenway/nest-common/database';
import { and, asc, eq, lte, sql } from 'drizzle-orm';

import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import { AvatarUpload } from '../../../../../domain/aggregates/avatar-upload/avatar-upload.aggregate.js';
import type { AvatarUploadStatus } from '../../../../../domain/value-objects/avatar/avatar-upload-status.value-object.js';
import users from '../../schemas/accounts/user.schema.js';
import avatarUploads from '../../schemas/avatar/avatar-uploads.schema.js';
import { DrizzleUserRepository } from '../accounts/drizzle-user.repository.js';

type UploadRow = typeof avatarUploads.$inferSelect;

function toUpload(row: UploadRow): AvatarUpload {
  return AvatarUpload.restore({ ...row, status: row.status as AvatarUploadStatus });
}

function digest(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

/** Account-scoped avatar persistence using the caller's existing system transaction. */
export class DrizzleAvatarRepository {
  // #region Properties
  /** Existing account reader and lock implementation. */
  private readonly accounts: DrizzleUserRepository;
  // #endregion

  // #region Constructor
  /** Binds all operations to the account transaction that owns the outbox. */
  public constructor(private readonly db: TransactionDatabase) {
    this.accounts = new DrizzleUserRepository(db);
  }
  // #endregion

  // #region Methods
  /** Locks an account before a reservation is locked or created. */
  public lockUser(userId: string): Promise<User | null> {
    return this.accounts.lock(userId);
  }

  /** Reads only the explicitly identified account. */
  public findUser(userId: string): Promise<User | null> {
    return this.accounts.findById(userId);
  }

  /** Reads a reservation only within its owner account. */
  public async findUpload(userId: string, uploadId: string): Promise<AvatarUpload | null> {
    const rows = await this.db
      .select()
      .from(avatarUploads)
      .where(and(eq(avatarUploads.userId, userId), eq(avatarUploads.id, uploadId)))
      .limit(1);
    return rows[0] === undefined ? null : toUpload(rows[0]);
  }

  /** Locks a reservation after its account has been locked. */
  public async lockUpload(userId: string, uploadId: string): Promise<AvatarUpload | null> {
    const rows = await this.db
      .select()
      .from(avatarUploads)
      .where(and(eq(avatarUploads.userId, userId), eq(avatarUploads.id, uploadId)))
      .limit(1)
      .for('update');
    return rows[0] === undefined ? null : toUpload(rows[0]);
  }

  /** Resolves a request key only for the verified owner. */
  public async findByIdempotencyKey(userId: string, key: string): Promise<AvatarUpload | null> {
    const rows = await this.db
      .select()
      .from(avatarUploads)
      .where(
        and(eq(avatarUploads.userId, userId), eq(avatarUploads.idempotencyDigest, digest(key))),
      )
      .limit(1);
    return rows[0] === undefined ? null : toUpload(rows[0]);
  }

  /** Allocates an opaque UUIDv7 using PostgreSQL. */
  public async newUploadId(): Promise<string> {
    const result = await this.db.execute<{ id: string }>(sql`select uuidv7() as id`);
    const id = result.rows[0]?.id;
    if (id === undefined) throw new Error('The database did not allocate an avatar upload ID.');
    return id;
  }

  /** Stores a reservation and its optional account-scoped request binding atomically. */
  public async insertUpload(upload: AvatarUpload, idempotencyKey?: string): Promise<void> {
    const state = upload.snapshot;
    await this.db.insert(avatarUploads).values({
      ...state,
      idempotencyDigest: idempotencyKey === undefined ? null : digest(idempotencyKey),
    });
  }

  /** Saves a terminal transition for the owner and reservation already locked. */
  public async saveUpload(upload: AvatarUpload): Promise<void> {
    const state = upload.snapshot;
    const rows = await this.db
      .update(avatarUploads)
      .set({ status: state.status, updatedAt: sql`now()` })
      .where(
        and(
          eq(avatarUploads.userId, state.userId),
          eq(avatarUploads.id, state.id),
          eq(avatarUploads.generation, state.generation),
          eq(avatarUploads.status, 'pending'),
        ),
      )
      .returning({ id: avatarUploads.id });
    if (rows.length !== 1) throw new Error('The avatar upload changed since it was locked.');
  }

  /** Writes the private generation even when an unchanged public avatar leaves its version intact. */
  public async saveAvatar(previous: User, next: User): Promise<void> {
    if (previous.id !== next.id) throw new Error('The avatar account changed.');
    const rows = await this.db
      .update(users)
      .set({
        avatarId: next.avatarId,
        avatarGeneration: next.avatarGeneration,
        version: next.version,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(users.id, previous.id),
          eq(users.version, previous.version),
          eq(users.avatarGeneration, previous.avatarGeneration),
        ),
      )
      .returning({ id: users.id });
    if (rows.length !== 1) throw new Error('The avatar account changed since it was locked.');
  }

  /** Selects a bounded page of expired reservations for later owner-scoped rechecking. */
  public async findExpired(
    now: Date,
    limit: number,
  ): Promise<readonly { userId: string; uploadId: string }[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500)
      throw new RangeError('Invalid page size.');
    return this.db
      .select({ userId: avatarUploads.userId, uploadId: avatarUploads.id })
      .from(avatarUploads)
      .where(and(eq(avatarUploads.status, 'pending'), lte(avatarUploads.expiresAt, now)))
      .orderBy(asc(avatarUploads.expiresAt), asc(avatarUploads.userId), asc(avatarUploads.id))
      .limit(limit);
  }
  // #endregion
}
