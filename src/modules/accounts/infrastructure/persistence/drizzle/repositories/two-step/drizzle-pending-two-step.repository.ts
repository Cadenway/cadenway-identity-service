import type { TransactionDatabase } from '@cadenway/nest-common/database';
import { and, eq, ne, sql } from 'drizzle-orm';

import type { PendingTwoStepRepository } from '../../../../../application/ports/outbound/persistence/two-step/pending-two-step-repository.port.js';
import type { PendingTwoStepStart } from '../../../../../domain/value-objects/two-step/pending-two-step-start.value-object.js';
import setups from '../../schemas/two-step/authenticator-app-setup.schema.js';
import registrations from '../../schemas/two-step/security-key-registration.schema.js';

/**
 * Class DrizzlePendingTwoStepRepository
 *
 * @description
 * `PendingTwoStepRepository` on `authenticator_app_setups` and `security_key_registrations`, one
 * row of each per account, keyed by the account.
 */
export class DrizzlePendingTwoStepRepository implements PendingTwoStepRepository {
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
   * Method putSetup
   *
   * @description
   * Stores the pending setup of the account in place of the previous one.
   *
   * @param {string} userId - The account.
   * @param {PendingTwoStepStart} pending - The setup.
   * @returns {Promise<void>} Resolves once written.
   */
  public async putSetup(userId: string, pending: PendingTwoStepStart): Promise<void> {
    await this.db
      .insert(setups)
      .values({
        userId,
        sessionId: pending.sessionId,
        secret: pending.value,
        expiresAt: pending.expiresAt,
      })
      .onConflictDoUpdate({
        target: setups.userId,
        set: {
          sessionId: pending.sessionId,
          secret: pending.value,
          expiresAt: pending.expiresAt,
          updatedAt: sql`now()`,
        },
      });
  }

  /**
   * Method findSetup
   *
   * @description
   * The pending setup of the account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<PendingTwoStepStart | null>} It, or `null`.
   */
  public async findSetup(userId: string): Promise<PendingTwoStepStart | null> {
    const rows: (typeof setups.$inferSelect)[] = await this.db
      .select()
      .from(setups)
      .where(eq(setups.userId, userId))
      .limit(1);
    const row: typeof setups.$inferSelect | undefined = rows[0];
    return row === undefined
      ? null
      : { sessionId: row.sessionId, value: row.secret, expiresAt: row.expiresAt };
  }

  /**
   * Method putRegistration
   *
   * @description
   * Stores the pending registration of the account in place of the previous one.
   *
   * @param {string} userId - The account.
   * @param {PendingTwoStepStart} pending - The registration.
   * @returns {Promise<void>} Resolves once written.
   */
  public async putRegistration(userId: string, pending: PendingTwoStepStart): Promise<void> {
    await this.db
      .insert(registrations)
      .values({
        userId,
        sessionId: pending.sessionId,
        challenge: pending.value,
        expiresAt: pending.expiresAt,
      })
      .onConflictDoUpdate({
        target: registrations.userId,
        set: {
          sessionId: pending.sessionId,
          challenge: pending.value,
          expiresAt: pending.expiresAt,
          updatedAt: sql`now()`,
        },
      });
  }

  /**
   * Method findRegistration
   *
   * @description
   * The pending registration of the account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<PendingTwoStepStart | null>} It, or `null`.
   */
  public async findRegistration(userId: string): Promise<PendingTwoStepStart | null> {
    const rows: (typeof registrations.$inferSelect)[] = await this.db
      .select()
      .from(registrations)
      .where(eq(registrations.userId, userId))
      .limit(1);
    const row: typeof registrations.$inferSelect | undefined = rows[0];
    return row === undefined
      ? null
      : { sessionId: row.sessionId, value: row.challenge, expiresAt: row.expiresAt };
  }

  /**
   * Method deleteSetup
   *
   * @description
   * Deletes the pending setup of the account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves once deleted.
   */
  public async deleteSetup(userId: string): Promise<void> {
    await this.db.delete(setups).where(eq(setups.userId, userId));
  }

  /**
   * Method deleteRegistration
   *
   * @description
   * Deletes the pending registration of the account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves once deleted.
   */
  public async deleteRegistration(userId: string): Promise<void> {
    await this.db.delete(registrations).where(eq(registrations.userId, userId));
  }

  /**
   * Method dropOfOtherSessions
   *
   * @description
   * Deletes the pending setup and registration of the account started by another session.
   *
   * @param {string} userId - The account.
   * @param {string} sessionId - The session that keeps its own.
   * @returns {Promise<void>} Resolves once deleted.
   */
  public async dropOfOtherSessions(userId: string, sessionId: string): Promise<void> {
    await this.db
      .delete(setups)
      .where(and(eq(setups.userId, userId), ne(setups.sessionId, sessionId)));
    await this.db
      .delete(registrations)
      .where(and(eq(registrations.userId, userId), ne(registrations.sessionId, sessionId)));
  }

  /**
   * Method dropOfUser
   *
   * @description
   * Deletes the pending setup and registration of the account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves once deleted.
   */
  public async dropOfUser(userId: string): Promise<void> {
    await this.deleteSetup(userId);
    await this.deleteRegistration(userId);
  }
  // #endregion
}
