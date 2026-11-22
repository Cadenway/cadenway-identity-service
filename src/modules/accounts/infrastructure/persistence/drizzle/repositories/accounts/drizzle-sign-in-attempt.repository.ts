import type { TransactionDatabase } from '@cadenway/nest-common/database';
import { eq, sql } from 'drizzle-orm';

import type { SignInAttemptRepository } from '../../../../../application/ports/outbound/persistence/accounts/sign-in-attempt-repository.port.js';
import { PasswordLockout } from '../../../../../domain/policies/password/password-lockout.policy.js';
import type { EmailAddress } from '../../../../../domain/value-objects/email/email-address.value-object.js';
import signInAttempts from '../../schemas/accounts/sign-in-attempt.schema.js';

/**
 * Class DrizzleSignInAttemptRepository
 *
 * @description
 * `SignInAttemptRepository` on the `sign_in_attempts` table, in the transaction of its unit of
 * work; keyed by the normalized address.
 */
export class DrizzleSignInAttemptRepository implements SignInAttemptRepository {
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
   * @returns {Promise<PasswordLockout>} The lockout of the address.
   * @throws {Error} When the row is missing right after its insert, which never happens.
   */
  public async lock(email: EmailAddress): Promise<PasswordLockout> {
    const fields = {
      failedAttempts: signInAttempts.failedAttempts,
      lockedUntil: signInAttempts.lockedUntil,
    };
    const [existing] = await this.db
      .select(fields)
      .from(signInAttempts)
      .where(eq(signInAttempts.email, email.value))
      .for('update');
    const row: { failedAttempts: number; lockedUntil: Date | null } | undefined =
      existing ??
      (
        await this.db
          .insert(signInAttempts)
          .values({ email: email.value })
          .onConflictDoUpdate({
            target: signInAttempts.email,
            set: { updatedAt: sql`${signInAttempts.updatedAt}` },
          })
          .returning(fields)
      )[0];
    if (row === undefined) {
      throw new Error('The lockout row of an address could not be read after its upsert.');
    }
    return PasswordLockout.restore(row);
  }

  /**
   * Method save
   *
   * @description
   * Writes the lockout of the address. A clear lockout is written as zero rather than deleted: a
   * sign-in waiting on the lock of the row would otherwise find it gone.
   *
   * @param {EmailAddress} email - The normalized address.
   * @param {PasswordLockout} lockout - The lockout to store.
   * @returns {Promise<void>} Resolves once written.
   */
  public async save(email: EmailAddress, lockout: PasswordLockout): Promise<void> {
    await this.db
      .update(signInAttempts)
      .set({
        failedAttempts: lockout.snapshot.failedAttempts,
        lockedUntil: lockout.snapshot.lockedUntil,
        updatedAt: sql`now()`,
      })
      .where(eq(signInAttempts.email, email.value));
  }

  /**
   * Method erase
   *
   * @description
   * Deletes the lockout row of an address.
   *
   * @param {EmailAddress} email - The normalized address.
   * @returns {Promise<void>} Resolves once deleted.
   */
  public async erase(email: EmailAddress): Promise<void> {
    await this.db.delete(signInAttempts).where(eq(signInAttempts.email, email.value));
  }
  // #endregion
}
