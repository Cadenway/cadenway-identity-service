import type { TransactionDatabase } from '@cadenway/nest-common/database';
import { and, count, eq, isNull, sql } from 'drizzle-orm';

import type { BackupCodeRepository } from '../../../../../application/ports/outbound/persistence/two-step/backup-code-repository.port.js';
import backupCodes from '../../schemas/two-step/backup-code.schema.js';

/**
 * Class DrizzleBackupCodeRepository
 *
 * @description
 * `BackupCodeRepository` on `backup_codes`, through its unique index on the account and the hash.
 * A code is used up by one `update ... where used_at is null`, so two concurrent answers with the
 * same code cannot both use it.
 */
export class DrizzleBackupCodeRepository implements BackupCodeRepository {
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
   * Method replaceAll
   *
   * @description
   * Deletes the codes of the account and inserts the new ones.
   *
   * @param {string} userId - The account.
   * @param {readonly string[]} codeHashes - The hashes of the new codes.
   * @returns {Promise<void>} Resolves once written.
   */
  public async replaceAll(userId: string, codeHashes: readonly string[]): Promise<void> {
    await this.db.delete(backupCodes).where(eq(backupCodes.userId, userId));
    await this.db
      .insert(backupCodes)
      .values(codeHashes.map((codeHash: string) => ({ userId, codeHash })));
  }

  /**
   * Method countUnused
   *
   * @description
   * Counts the unused codes of the account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<number>} Its unused codes.
   */
  public async countUnused(userId: string): Promise<number> {
    const rows: { count: number }[] = await this.db
      .select({ count: count() })
      .from(backupCodes)
      .where(and(eq(backupCodes.userId, userId), isNull(backupCodes.usedAt)));
    return rows[0]?.count ?? 0;
  }

  /**
   * Method use
   *
   * @description
   * Marks an unused code of the account used.
   *
   * @param {string} userId - The account.
   * @param {string} codeHash - The hash of the answer.
   * @param {Date} now - When it is used.
   * @returns {Promise<boolean>} `true` when it was an unused code of the account.
   */
  public async use(userId: string, codeHash: string, now: Date): Promise<boolean> {
    const used: { id: string }[] = await this.db
      .update(backupCodes)
      .set({ usedAt: now, updatedAt: sql`now()` })
      .where(
        and(
          eq(backupCodes.userId, userId),
          eq(backupCodes.codeHash, codeHash),
          isNull(backupCodes.usedAt),
        ),
      )
      .returning({ id: backupCodes.id });
    return used.length === 1;
  }

  /**
   * Method deleteOfUser
   *
   * @description
   * Deletes every code of the account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves once deleted.
   */
  public async deleteOfUser(userId: string): Promise<void> {
    await this.db.delete(backupCodes).where(eq(backupCodes.userId, userId));
  }
  // #endregion
}
