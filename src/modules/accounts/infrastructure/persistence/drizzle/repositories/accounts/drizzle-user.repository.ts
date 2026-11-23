import type { TransactionDatabase } from '@cadenway/nest-common/database';
import { and, asc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';

import type { DueAccountDeletion } from '../../../../../application/models/deletion/due-account-deletion.model.js';
import type { UserRepository } from '../../../../../application/ports/outbound/persistence/accounts/user-repository.port.js';
import type { UserRegistration } from '../../../../../domain/aggregates/account/user-registration.aggregate.js';
import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import type { EmailAddress } from '../../../../../domain/value-objects/email/email-address.value-object.js';
import type { UserRow } from '../../mappers/accounts/user.mapper.js';
import { toUser } from '../../mappers/accounts/user.mapper.js';
import users from '../../schemas/accounts/user.schema.js';

/**
 * Class DrizzleUserRepository
 *
 * @description
 * `UserRepository` on the `users` table, in the transaction of its unit of work. Every read names
 * the account by its unique address or its id, both indexed.
 */
export class DrizzleUserRepository implements UserRepository {
  // #region Properties
  /**
   * Property db
   *
   * @description
   * The Drizzle database of the transaction.
   *
   * @type {TransactionDatabase}
   * @readonly
   */
  private readonly db: TransactionDatabase;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the repository to a transaction.
   *
   * @param {TransactionDatabase} db - The Drizzle database of the transaction.
   * @constructor
   */
  public constructor(db: TransactionDatabase) {
    this.db = db;
  }
  // #endregion

  // #region Methods
  /**
   * Method findByEmail
   *
   * @description
   * Loads the account of an address, optionally locking its row.
   *
   * @param {EmailAddress} email - The normalized address.
   * @param {boolean} forUpdate - Whether to lock the row.
   * @returns {Promise<User | null>} The account, or `null`.
   */
  public async findByEmail(email: EmailAddress, forUpdate: boolean): Promise<User | null> {
    const rows: UserRow[] = forUpdate
      ? await this.db
          .select()
          .from(users)
          .where(eq(users.email, email.value))
          .limit(1)
          .for('update')
      : await this.db.select().from(users).where(eq(users.email, email.value)).limit(1);
    const row: UserRow | undefined = rows[0];
    return row === undefined ? null : toUser(row);
  }

  /**
   * Method findById
   *
   * @description
   * Loads an account by its id.
   *
   * @param {string} id - Id of the account.
   * @returns {Promise<User | null>} The account, or `null`.
   */
  public async findById(id: string): Promise<User | null> {
    const rows: UserRow[] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    const row: UserRow | undefined = rows[0];
    return row === undefined ? null : toUser(row);
  }

  /**
   * Method lock
   *
   * @description
   * Loads and locks an account by its id.
   *
   * @param {string} id - Id of the account.
   * @returns {Promise<User | null>} The account, or `null`.
   */
  public async lock(id: string): Promise<User | null> {
    const rows: UserRow[] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
      .for('update');
    const row: UserRow | undefined = rows[0];
    return row === undefined ? null : toUser(row);
  }

  /**
   * Method insert
   *
   * @description
   * Inserts a new account and reads back the id PostgreSQL assigned.
   *
   * @param {UserRegistration} registration - The account to create.
   * @returns {Promise<User>} The stored account.
   * @throws {Error} When PostgreSQL returns no row, which never happens for a successful insert.
   */
  public async insert(registration: UserRegistration): Promise<User> {
    const rows: UserRow[] = await this.db
      .insert(users)
      .values({
        email: registration.email.value,
        name: registration.name,
        language: registration.language,
        displayName: registration.displayName,
        jobTitle: registration.jobTitle,
        timeZone: registration.timeZone,
        version: registration.version,
        signUpCount: registration.signUpCount,
        passwordChangedAt: registration.passwordChangedAt,
      })
      .returning();
    const row: UserRow | undefined = rows[0];
    if (row === undefined) {
      throw new Error('The insert of an account returned no row.');
    }
    return toUser(row);
  }

  /**
   * Method update
   *
   * @description
   * Writes the name, the profile, the verification, the version and the sign-up count of an
   * account whose stored version is the previous one.
   *
   * @param {User} user - The account after the change.
   * @returns {Promise<void>} Resolves once written.
   * @throws {Error} When no row has the previous version.
   */
  public async update(user: User): Promise<void> {
    const updated: { id: string }[] = await this.db
      .update(users)
      .set({
        name: user.name,
        displayName: user.displayName,
        jobTitle: user.jobTitle,
        timeZone: user.timeZone,
        language: user.language,
        emailVerifiedAt: user.emailVerifiedAt,
        version: user.version,
        signUpCount: user.signUpCount,
        email: user.email.value,
        passwordChangedAt: user.passwordChangedAt,
        deleteAt: user.deleteAt,
        ...(user.deleteAt === null ? { deletionCheckedAt: null } : {}),
        updatedAt: sql`now()`,
      })
      .where(and(eq(users.id, user.id), eq(users.version, user.version - 1)))
      .returning({ id: users.id });
    if (updated.length !== 1) {
      throw new Error('The account changed since it was loaded.');
    }
  }

  /**
   * Method findDueDeletions
   *
   * @description
   * Claims the due deletions with `for update skip locked`, through the partial index on
   * `delete_at`.
   *
   * @param {Date} now - The instant of the sweep.
   * @param {Date} checkedBefore - Accounts checked since then are left out.
   * @param {number} limit - Accounts claimed at most.
   * @returns {Promise<DueAccountDeletion[]>} The claimed accounts, the oldest deletion first.
   */
  public async findDueDeletions(
    now: Date,
    checkedBefore: Date,
    limit: number,
  ): Promise<DueAccountDeletion[]> {
    const rows: { id: string; deleteAt: Date | null; deletionCheckedAt: Date | null }[] =
      await this.db
        .select({
          id: users.id,
          deleteAt: users.deleteAt,
          deletionCheckedAt: users.deletionCheckedAt,
        })
        .from(users)
        .where(
          and(
            lte(users.deleteAt, now),
            or(isNull(users.deletionCheckedAt), lte(users.deletionCheckedAt, checkedBefore)),
          ),
        )
        .orderBy(sql`coalesce(${users.deletionCheckedAt}, ${users.deleteAt})`, asc(users.id))
        .limit(limit)
        .for('update', { skipLocked: true });
    return rows.flatMap(
      (row: { id: string; deleteAt: Date | null; deletionCheckedAt: Date | null }) => {
        const dueSince: Date | null = row.deletionCheckedAt ?? row.deleteAt;
        return dueSince === null ? [] : [{ userId: row.id, dueSince }];
      },
    );
  }

  /** Advances the scheduling fence of the locked sweep batch atomically with its jobs. */
  public async markDeletionsDispatched(userIds: readonly string[], now: Date): Promise<void> {
    await this.db
      .update(users)
      .set({ deletionCheckedAt: now })
      .where(inArray(users.id, [...userIds]));
  }

  /** Reads the claim of the account locked by the caller. */
  public async findDeletionAttempt(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ attemptId: users.deletionAttemptId })
      .from(users)
      .where(eq(users.id, userId));
    return row?.attemptId ?? null;
  }

  /** Creates a stable database-generated attempt while the caller holds the user lock. */
  public async claimDeletion(userId: string): Promise<string> {
    const [row] = await this.db
      .update(users)
      .set({ deletionAttemptId: sql`uuidv7()` })
      .where(and(eq(users.id, userId), isNull(users.deletionAttemptId)))
      .returning({ attemptId: users.deletionAttemptId });
    const attemptId = row?.attemptId;
    if (attemptId == null) throw new Error('The locked account could not be claimed.');
    return attemptId;
  }

  /** Releases only this attempt after an explicit ownership refusal. */
  public async keepDeletion(userId: string, attemptId: string, now: Date): Promise<void> {
    await this.db
      .update(users)
      .set({ deletionAttemptId: null, deletionCheckedAt: now, updatedAt: sql`now()` })
      .where(and(eq(users.id, userId), eq(users.deletionAttemptId, attemptId)));
  }

  /**
   * Method delete
   *
   * @description
   * Deletes the account at the version it was locked at; its credential, codes, reset links and
   * pending change of address are deleted by their foreign keys (`on delete cascade`).
   *
   * @param {User} user - The locked account.
   * @param {string} confirmedAttemptId - The Organization-confirmed claim for a scheduled account.
   * @returns {Promise<void>} Resolves once deleted.
   * @throws {Error} When the stored version moved meanwhile.
   */
  public async delete(user: User, confirmedAttemptId?: string): Promise<void> {
    if (confirmedAttemptId !== undefined) {
      // The scheduled-delete trigger also fences older workers during a rolling upgrade.
      await this.db.execute(
        sql`select set_config('app.account_deletion_attempt_id', ${confirmedAttemptId}, true)`,
      );
    }
    const deleted: { id: string }[] = await this.db
      .delete(users)
      .where(
        and(
          eq(users.id, user.id),
          eq(users.version, user.version),
          confirmedAttemptId === undefined
            ? undefined
            : eq(users.deletionAttemptId, confirmedAttemptId),
        ),
      )
      .returning({ id: users.id });
    if (deleted.length !== 1) {
      throw new Error('The account changed since it was loaded.');
    }
  }
  // #endregion
}
