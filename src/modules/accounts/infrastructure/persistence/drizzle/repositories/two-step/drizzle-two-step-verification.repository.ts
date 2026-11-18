import type { TransactionDatabase } from '@cadenway/nest-common/database';
import { eq, sql } from 'drizzle-orm';

import type { TwoStepVerificationRepository } from '../../../../../application/ports/outbound/persistence/two-step/two-step-verification-repository.port.js';
import { TwoStepVerification } from '../../../../../domain/aggregates/two-step/two-step-verification.aggregate.js';
import verifications from '../../schemas/two-step/two-step-verification.schema.js';

/**
 * Function toTwoStepVerification
 *
 * @description
 * Maps a row of `two_step_verifications` to the two-step verification it stores.
 *
 * @param {typeof verifications.$inferSelect} row - The row.
 * @returns {TwoStepVerification} The two-step verification.
 */
function toTwoStepVerification(row: typeof verifications.$inferSelect): TwoStepVerification {
  return TwoStepVerification.restore({
    userId: row.userId,
    sealedSecret: row.authenticatorSecret,
    authenticatorConfiguredAt: row.authenticatorConfiguredAt,
    lastAcceptedTimeStep: row.lastAcceptedTimeStep,
    webauthnUserHandle: row.webauthnUserHandle,
    failedAnswers: row.failedAnswers,
    lockedUntil: row.lockedUntil,
    backupCodesGeneratedAt: row.backupCodesGeneratedAt,
    enabledAt: row.enabledAt,
  });
}

/**
 * Class DrizzleTwoStepVerificationRepository
 *
 * @description
 * `TwoStepVerificationRepository` on `two_step_verifications`, in the system transaction of the
 * unit of work, by the primary key of the account.
 */
export class DrizzleTwoStepVerificationRepository implements TwoStepVerificationRepository {
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
   * Method find
   *
   * @description
   * Reads the two-step verification of the account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<TwoStepVerification | null>} It, or `null`.
   */
  public async find(userId: string): Promise<TwoStepVerification | null> {
    const rows: (typeof verifications.$inferSelect)[] = await this.db
      .select()
      .from(verifications)
      .where(eq(verifications.userId, userId))
      .limit(1);
    const row: typeof verifications.$inferSelect | undefined = rows[0];
    return row === undefined ? null : toTwoStepVerification(row);
  }

  /**
   * Method lock
   *
   * @description
   * Reads and locks the two-step verification of the account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<TwoStepVerification | null>} It, or `null`.
   */
  public async lock(userId: string): Promise<TwoStepVerification | null> {
    const rows: (typeof verifications.$inferSelect)[] = await this.db
      .select()
      .from(verifications)
      .where(eq(verifications.userId, userId))
      .limit(1)
      .for('update');
    const row: typeof verifications.$inferSelect | undefined = rows[0];
    return row === undefined ? null : toTwoStepVerification(row);
  }

  /**
   * Method insert
   *
   * @description
   * Inserts the two-step verification of an account that turns it on.
   *
   * @param {TwoStepVerification} verification - It.
   * @returns {Promise<void>} Resolves once written.
   */
  public async insert(verification: TwoStepVerification): Promise<void> {
    const state: TwoStepVerification['snapshot'] = verification.snapshot;
    await this.db.insert(verifications).values({
      userId: state.userId,
      authenticatorSecret: state.sealedSecret,
      authenticatorConfiguredAt: state.authenticatorConfiguredAt,
      lastAcceptedTimeStep: state.lastAcceptedTimeStep,
      webauthnUserHandle: state.webauthnUserHandle,
      failedAnswers: state.failedAnswers,
      lockedUntil: state.lockedUntil,
      backupCodesGeneratedAt: state.backupCodesGeneratedAt,
      enabledAt: state.enabledAt,
    });
  }

  /**
   * Method update
   *
   * @description
   * Writes a change of the two-step verification of the account.
   *
   * @param {TwoStepVerification} verification - It after the change.
   * @returns {Promise<void>} Resolves once written.
   */
  public async update(verification: TwoStepVerification): Promise<void> {
    const state: TwoStepVerification['snapshot'] = verification.snapshot;
    await this.db
      .update(verifications)
      .set({
        authenticatorSecret: state.sealedSecret,
        authenticatorConfiguredAt: state.authenticatorConfiguredAt,
        lastAcceptedTimeStep: state.lastAcceptedTimeStep,
        failedAnswers: state.failedAnswers,
        lockedUntil: state.lockedUntil,
        backupCodesGeneratedAt: state.backupCodesGeneratedAt,
        updatedAt: sql`now()`,
      })
      .where(eq(verifications.userId, state.userId));
  }

  /**
   * Method delete
   *
   * @description
   * Deletes the two-step verification of the account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves once deleted.
   */
  public async delete(userId: string): Promise<void> {
    await this.db.delete(verifications).where(eq(verifications.userId, userId));
  }
  // #endregion
}
