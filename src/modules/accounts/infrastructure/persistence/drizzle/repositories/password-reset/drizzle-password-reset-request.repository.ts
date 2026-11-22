import type { TransactionDatabase } from '@cadenway/nest-common/database';
import { eq, sql } from 'drizzle-orm';

import type { PasswordResetRequestRepository } from '../../../../../application/ports/outbound/persistence/accounts/password-reset-request-repository.port.js';
import type { CodeRequestThrottleState } from '../../../../../domain/policies/one-time-codes/code-request-throttle-state.policy.js';
import { PasswordResetThrottle } from '../../../../../domain/policies/password-reset/password-reset-throttle.policy.js';
import type { EmailAddress } from '../../../../../domain/value-objects/email/email-address.value-object.js';
import passwordResetRequests from '../../schemas/password-reset/password-reset-request.schema.js';

/**
 * Class DrizzlePasswordResetRequestRepository
 *
 * @description
 * `PasswordResetRequestRepository` on `password_reset_requests`, keyed by the normalized address,
 * in the transaction of its unit of work.
 */
export class DrizzlePasswordResetRequestRepository implements PasswordResetRequestRepository {
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
   * Method lock
   *
   * @description
   * Locks the existing counter, or atomically creates and locks it when missing.
   * Cleanup may remove an expired counter before this transaction can lock it.
   *
   * @param {EmailAddress} email - The normalized address.
   * @returns {Promise<PasswordResetThrottle>} The throttle.
   */
  public async lock(email: EmailAddress): Promise<PasswordResetThrottle> {
    const fields = {
      lastRequestedAt: passwordResetRequests.lastRequestedAt,
      windowStartedAt: passwordResetRequests.windowStartedAt,
      windowRequests: passwordResetRequests.windowRequests,
    };
    const [existing] = await this.db
      .select(fields)
      .from(passwordResetRequests)
      .where(eq(passwordResetRequests.email, email.value))
      .for('update');
    const row: CodeRequestThrottleState | undefined =
      existing ??
      (
        await this.db
          .insert(passwordResetRequests)
          .values({ email: email.value })
          .onConflictDoUpdate({
            target: passwordResetRequests.email,
            set: { updatedAt: sql`${passwordResetRequests.updatedAt}` },
          })
          .returning(fields)
      )[0];
    if (row === undefined) {
      throw new Error(
        'The throttle row of a password reset request could not be read after its upsert.',
      );
    }
    return PasswordResetThrottle.restore(row);
  }

  /**
   * Method save
   *
   * @description
   * Writes the throttle of the address.
   *
   * @param {EmailAddress} email - The normalized address.
   * @param {PasswordResetThrottle} throttle - The throttle after the request.
   * @returns {Promise<void>} Resolves once written.
   */
  public async save(email: EmailAddress, throttle: PasswordResetThrottle): Promise<void> {
    await this.db
      .update(passwordResetRequests)
      .set({ ...throttle.snapshot, updatedAt: sql`now()` })
      .where(eq(passwordResetRequests.email, email.value));
  }

  /**
   * Method erase
   *
   * @description
   * Deletes the throttle row of an address.
   *
   * @param {EmailAddress} email - The normalized address.
   * @returns {Promise<void>} Resolves once deleted.
   */
  public async erase(email: EmailAddress): Promise<void> {
    await this.db.delete(passwordResetRequests).where(eq(passwordResetRequests.email, email.value));
  }
  // #endregion
}
