import type { TransactionDatabase } from '@cadenway/nest-common/database';
import { eq, sql } from 'drizzle-orm';

import type { EmailChangeRepository } from '../../../../../application/ports/outbound/persistence/accounts/email-change-repository.port.js';
import type { PendingEmailChange } from '../../../../../domain/value-objects/email-change/pending-email-change.value-object.js';
import { EmailAddress } from '../../../../../domain/value-objects/email/email-address.value-object.js';
import emailChanges from '../../schemas/email-change/email-change.schema.js';

/**
 * Class DrizzleEmailChangeRepository
 *
 * @description
 * `EmailChangeRepository` on `email_changes`, keyed by the account, in the transaction of its unit
 * of work.
 */
export class DrizzleEmailChangeRepository implements EmailChangeRepository {
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
   * Reads and locks the pending change of an account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<PendingEmailChange | null>} The change, or `null`.
   */
  public async find(userId: string): Promise<PendingEmailChange | null> {
    const rows: { userId: string; sessionId: string; email: string }[] = await this.db
      .select({
        userId: emailChanges.userId,
        sessionId: emailChanges.sessionId,
        email: emailChanges.email,
      })
      .from(emailChanges)
      .where(eq(emailChanges.userId, userId))
      .limit(1)
      .for('update');
    const row: { userId: string; sessionId: string; email: string } | undefined = rows[0];
    return row === undefined
      ? null
      : { userId: row.userId, sessionId: row.sessionId, email: EmailAddress.of(row.email) };
  }

  /**
   * Method save
   *
   * @description
   * Inserts the pending change of an account, or replaces it.
   *
   * @param {PendingEmailChange} change - The change.
   * @returns {Promise<void>} Resolves once written.
   */
  public async save(change: PendingEmailChange): Promise<void> {
    await this.db
      .insert(emailChanges)
      .values({ userId: change.userId, sessionId: change.sessionId, email: change.email.value })
      .onConflictDoUpdate({
        target: emailChanges.userId,
        set: {
          sessionId: change.sessionId,
          email: change.email.value,
          createdAt: sql`now()`,
          updatedAt: sql`now()`,
        },
      });
  }

  /**
   * Method drop
   *
   * @description
   * Deletes the pending change of an account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves once deleted.
   */
  public async drop(userId: string): Promise<void> {
    await this.db.delete(emailChanges).where(eq(emailChanges.userId, userId));
  }
  // #endregion
}
