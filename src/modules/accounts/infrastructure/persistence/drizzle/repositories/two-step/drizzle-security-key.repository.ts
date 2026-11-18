import type { TransactionDatabase } from '@cadenway/nest-common/database';
import { and, asc, eq, sql } from 'drizzle-orm';

import type { SecurityKeyRecord } from '../../../../../application/models/two-step/security-key-record.model.js';
import type { VerifiedRegistration } from '../../../../../application/models/two-step/verified-registration.model.js';
import type { SecurityKeyRepository } from '../../../../../application/ports/outbound/persistence/two-step/security-key-repository.port.js';
import securityKeys from '../../schemas/two-step/security-key.schema.js';

/**
 * Function toSecurityKeyRecord
 *
 * @description
 * Maps a row of `security_keys` to what the use cases read of a key.
 *
 * @param {typeof securityKeys.$inferSelect} row - The row.
 * @returns {SecurityKeyRecord} The key.
 */
function toSecurityKeyRecord(row: typeof securityKeys.$inferSelect): SecurityKeyRecord {
  return {
    id: row.id,
    name: row.name,
    credentialId: row.credentialId,
    publicKey: row.publicKey,
    counter: row.counter,
    transports: row.transports,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
  };
}

/**
 * Class DrizzleSecurityKeyRepository
 *
 * @description
 * `SecurityKeyRepository` on `security_keys`: the keys of an account through the index on
 * `user_id`, a credential through its unique index across accounts.
 */
export class DrizzleSecurityKeyRepository implements SecurityKeyRepository {
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
   * Method listOfUser
   *
   * @description
   * The keys of the account, the oldest first.
   *
   * @param {string} userId - The account.
   * @returns {Promise<SecurityKeyRecord[]>} Its keys.
   */
  public async listOfUser(userId: string): Promise<SecurityKeyRecord[]> {
    const rows: (typeof securityKeys.$inferSelect)[] = await this.db
      .select()
      .from(securityKeys)
      .where(eq(securityKeys.userId, userId))
      .orderBy(asc(securityKeys.createdAt), asc(securityKeys.id));
    return rows.map(toSecurityKeyRecord);
  }

  /**
   * Method findOfUser
   *
   * @description
   * A key of the account by its id.
   *
   * @param {string} userId - The account.
   * @param {string} id - The id of the key.
   * @returns {Promise<SecurityKeyRecord | null>} The key, or `null`.
   */
  public async findOfUser(userId: string, id: string): Promise<SecurityKeyRecord | null> {
    const rows: (typeof securityKeys.$inferSelect)[] = await this.db
      .select()
      .from(securityKeys)
      .where(and(eq(securityKeys.id, id), eq(securityKeys.userId, userId)))
      .limit(1);
    const row: typeof securityKeys.$inferSelect | undefined = rows[0];
    return row === undefined ? null : toSecurityKeyRecord(row);
  }

  /**
   * Method credentialExists
   *
   * @description
   * Whether any account has this credential.
   *
   * @param {string} credentialId - The credential id.
   * @returns {Promise<boolean>} `true` when registered.
   */
  public async credentialExists(credentialId: string): Promise<boolean> {
    const rows: { id: string }[] = await this.db
      .select({ id: securityKeys.id })
      .from(securityKeys)
      .where(eq(securityKeys.credentialId, credentialId))
      .limit(1);
    return rows.length === 1;
  }

  /**
   * Method insert
   *
   * @description
   * Inserts a key and reads back its id. A credential registered meanwhile by another account
   * breaks the unique index and fails the transaction.
   *
   * @param {string} userId - The account.
   * @param {string} name - Its name.
   * @param {VerifiedRegistration} credential - Its credential.
   * @returns {Promise<SecurityKeyRecord>} The stored key.
   * @throws {Error} When PostgreSQL returns no row.
   */
  public async insert(
    userId: string,
    name: string,
    credential: VerifiedRegistration,
  ): Promise<SecurityKeyRecord> {
    const rows: (typeof securityKeys.$inferSelect)[] = await this.db
      .insert(securityKeys)
      .values({
        userId,
        name,
        credentialId: credential.credentialId,
        publicKey: credential.publicKey,
        counter: credential.counter,
        transports: [...credential.transports],
        backupEligible: credential.backupEligible,
        backedUp: credential.backedUp,
        userVerified: credential.userVerified,
      })
      .returning();
    const row: typeof securityKeys.$inferSelect | undefined = rows[0];
    if (row === undefined) {
      throw new Error('The insert of a security key returned no row.');
    }
    return toSecurityKeyRecord(row);
  }

  /**
   * Method recordUse
   *
   * @description
   * Records the counter and the last use of a key.
   *
   * @param {string} id - The id of the key.
   * @param {number} counter - The counter it reported.
   * @param {Date} now - When it answered.
   * @returns {Promise<void>} Resolves once written.
   */
  public async recordUse(id: string, counter: number, now: Date): Promise<void> {
    await this.db
      .update(securityKeys)
      .set({ counter, lastUsedAt: now, updatedAt: sql`now()` })
      .where(eq(securityKeys.id, id));
  }

  /**
   * Method delete
   *
   * @description
   * Deletes a key.
   *
   * @param {string} id - The id of the key.
   * @returns {Promise<void>} Resolves once deleted.
   */
  public async delete(id: string): Promise<void> {
    await this.db.delete(securityKeys).where(eq(securityKeys.id, id));
  }

  /**
   * Method deleteOfUser
   *
   * @description
   * Deletes every key of the account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves once deleted.
   */
  public async deleteOfUser(userId: string): Promise<void> {
    await this.db.delete(securityKeys).where(eq(securityKeys.userId, userId));
  }
  // #endregion
}
