import type { TransactionDatabase } from '@cadenway/nest-common/database';
import { and, desc, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';

import type { OneTimeCodeRepository } from '../../application/ports/account-repositories.port.js';
import { OneTimeCode } from '../../domain/one-time-code.js';
import type { OneTimeCodeIssue, OneTimeCodePurpose } from '../../domain/one-time-code.js';
import oneTimeCodes from './one-time-code.schema.js';

/**
 * Type OneTimeCodeRow
 *
 * @description
 * A row of `one_time_codes`.
 *
 * @type {typeof oneTimeCodes.$inferSelect}
 */
type OneTimeCodeRow = typeof oneTimeCodes.$inferSelect;

/**
 * Function toOneTimeCode
 *
 * @description
 * Maps a row to the code it stores.
 *
 * @param {OneTimeCodeRow} row - The row.
 * @returns {OneTimeCode} The code.
 */
function toOneTimeCode(row: OneTimeCodeRow): OneTimeCode {
  return OneTimeCode.restore({
    id: row.id,
    userId: row.userId,
    purpose: row.purpose,
    codeHash: row.codeHash,
    expiresAt: row.expiresAt,
    failedAttempts: row.failedAttempts,
    consumedAt: row.consumedAt,
    replacedAt: row.replacedAt,
  });
}

/**
 * Class DrizzleOneTimeCodeRepository
 *
 * @description
 * `OneTimeCodeRepository` on the `one_time_codes` table, in the transaction of its unit of work.
 * Every query names the account and the purpose, the leading columns of both indexes.
 */
export class DrizzleOneTimeCodeRepository implements OneTimeCodeRepository {
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
   * Method findCurrent
   *
   * @description
   * Loads and locks the code of an account and a purpose that is neither consumed nor replaced.
   *
   * @param {string} userId - Id of the account.
   * @param {OneTimeCodePurpose} purpose - What the code proves.
   * @returns {Promise<OneTimeCode | null>} The code, or `null`.
   */
  public async findCurrent(
    userId: string,
    purpose: OneTimeCodePurpose,
  ): Promise<OneTimeCode | null> {
    const rows: OneTimeCodeRow[] = await this.db
      .select()
      .from(oneTimeCodes)
      .where(
        and(
          eq(oneTimeCodes.userId, userId),
          eq(oneTimeCodes.purpose, purpose),
          isNull(oneTimeCodes.consumedAt),
          isNull(oneTimeCodes.replacedAt),
        ),
      )
      .orderBy(desc(oneTimeCodes.createdAt))
      .limit(1)
      .for('update');
    const row: OneTimeCodeRow | undefined = rows[0];
    return row === undefined ? null : toOneTimeCode(row);
  }

  /**
   * Method replaceCurrent
   *
   * @description
   * Marks the current code of an account and a purpose as replaced.
   *
   * @param {string} userId - Id of the account.
   * @param {OneTimeCodePurpose} purpose - What the codes prove.
   * @param {Date} now - When the code is replaced.
   * @returns {Promise<void>} Resolves once written.
   */
  public async replaceCurrent(
    userId: string,
    purpose: OneTimeCodePurpose,
    now: Date,
  ): Promise<void> {
    await this.db
      .update(oneTimeCodes)
      .set({ replacedAt: now, updatedAt: sql`now()` })
      .where(
        and(
          eq(oneTimeCodes.userId, userId),
          eq(oneTimeCodes.purpose, purpose),
          isNull(oneTimeCodes.consumedAt),
          isNull(oneTimeCodes.replacedAt),
        ),
      );
  }

  /**
   * Method insert
   *
   * @description
   * Inserts a new code and reads back the id PostgreSQL assigned.
   *
   * @param {OneTimeCodeIssue} issue - The code to store.
   * @returns {Promise<OneTimeCode>} The stored code.
   * @throws {Error} When PostgreSQL returns no row, which never happens for a successful insert.
   */
  public async insert(issue: OneTimeCodeIssue): Promise<OneTimeCode> {
    const rows: OneTimeCodeRow[] = await this.db
      .insert(oneTimeCodes)
      .values({
        userId: issue.userId,
        purpose: issue.purpose,
        codeHash: issue.codeHash,
        expiresAt: issue.expiresAt,
      })
      .returning();
    const row: OneTimeCodeRow | undefined = rows[0];
    if (row === undefined) {
      throw new Error('The insert of a one-time code returned no row.');
    }
    return toOneTimeCode(row);
  }

  /**
   * Method save
   *
   * @description
   * Writes the attempts and the use of a code.
   *
   * @param {OneTimeCode} code - The code after a check.
   * @returns {Promise<void>} Resolves once written.
   */
  public async save(code: OneTimeCode): Promise<void> {
    await this.db
      .update(oneTimeCodes)
      .set({
        failedAttempts: code.snapshot.failedAttempts,
        consumedAt: code.snapshot.consumedAt,
        updatedAt: sql`now()`,
      })
      .where(eq(oneTimeCodes.id, code.id));
  }

  /**
   * Method endedWithHash
   *
   * @description
   * Whether a consumed or replaced code of the account and purpose has this hash.
   *
   * @param {string} userId - Id of the account.
   * @param {OneTimeCodePurpose} purpose - What the code proves.
   * @param {string} codeHash - Keyed hash of the candidate.
   * @returns {Promise<boolean>} Whether one exists.
   */
  public async endedWithHash(
    userId: string,
    purpose: OneTimeCodePurpose,
    codeHash: string,
  ): Promise<boolean> {
    const rows: { id: string }[] = await this.db
      .select({ id: oneTimeCodes.id })
      .from(oneTimeCodes)
      .where(
        and(
          eq(oneTimeCodes.userId, userId),
          eq(oneTimeCodes.purpose, purpose),
          eq(oneTimeCodes.codeHash, codeHash),
          or(isNotNull(oneTimeCodes.consumedAt), isNotNull(oneTimeCodes.replacedAt)),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }
  // #endregion
}
