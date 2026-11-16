import type { TransactionDatabase } from '@cadenway/nest-common/database';
import { eq, sql } from 'drizzle-orm';

import type { PasswordCredentialRepository } from '../../../../../application/ports/outbound/persistence/accounts/password-credential-repository.port.js';
import passwordCredentials from '../../schemas/accounts/password-credential.schema.js';

/**
 * Class DrizzlePasswordCredentialRepository
 *
 * @description
 * `PasswordCredentialRepository` on the `password_credentials` table, in the transaction of its
 * unit of work; keyed by the id of the account.
 */
export class DrizzlePasswordCredentialRepository implements PasswordCredentialRepository {
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
   * Method findHash
   *
   * @description
   * Reads the encoded hash of the password of an account.
   *
   * @param {string} userId - Id of the account.
   * @returns {Promise<string | null>} The encoded hash, or `null`.
   */
  public async findHash(userId: string): Promise<string | null> {
    const rows: { passwordHash: string }[] = await this.db
      .select({ passwordHash: passwordCredentials.passwordHash })
      .from(passwordCredentials)
      .where(eq(passwordCredentials.userId, userId))
      .limit(1);
    return rows[0]?.passwordHash ?? null;
  }

  /**
   * Method save
   *
   * @description
   * Inserts or replaces the password hash of an account.
   *
   * @param {string} userId - Id of the account.
   * @param {string} passwordHash - The encoded hash.
   * @returns {Promise<void>} Resolves once written.
   */
  public async save(userId: string, passwordHash: string): Promise<void> {
    await this.db
      .insert(passwordCredentials)
      .values({ userId, passwordHash })
      .onConflictDoUpdate({
        target: passwordCredentials.userId,
        set: { passwordHash, updatedAt: sql`now()` },
      });
  }
  // #endregion
}
