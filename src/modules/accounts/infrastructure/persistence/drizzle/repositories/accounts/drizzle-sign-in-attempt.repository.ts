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
   * Creates the row of the address when it is missing, then locks it and reads the lockout.
   *
   * @param {EmailAddress} email - The normalized address.
   * @returns {Promise<PasswordLockout>} The lockout of the address.
   * @throws {Error} When the row is missing right after its insert, which never happens.
   */
  public async lock(email: EmailAddress): Promise<PasswordLockout> {
    await this.db.insert(signInAttempts).values({ email: email.value }).onConflictDoNothing();
    const rows: { failedAttempts: number; lockedUntil: Date | null }[] = await this.db
      .select({
        failedAttempts: signInAttempts.failedAttempts,
        lockedUntil: signInAttempts.lockedUntil,
      })
      .from(signInAttempts)
      .where(eq(signInAttempts.email, email.value))
      .for('update');
    const row: { failedAttempts: number; lockedUntil: Date | null } | undefined = rows[0];
    if (row === undefined) {
      throw new Error('The lockout row of an address is missing after its insert.');
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
  // #endregion
}
