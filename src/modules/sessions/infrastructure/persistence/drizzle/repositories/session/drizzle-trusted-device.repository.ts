import type { TransactionDatabase } from '@cadenway/nest-common/database';
import { and, desc, eq, gt, lte, notInArray, or } from 'drizzle-orm';

import type { TrustedDeviceRepository } from '../../../../../application/ports/outbound/persistence/session/trusted-device-repository.port.js';
import trustedDevices from '../../schemas/session/trusted-device.schema.js';

/**
 * Class DrizzleTrustedDeviceRepository
 *
 * @description
 * `TrustedDeviceRepository` on `trusted_devices`, in the system transaction of its unit of work.
 * A device is read by the unique hash of its token and its account; the devices of an account are
 * deleted through the index on `user_id`.
 */
export class DrizzleTrustedDeviceRepository implements TrustedDeviceRepository {
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
   * Method insert
   *
   * @description
   * Inserts a trusted device.
   *
   * @param {string} userId - The account.
   * @param {string} tokenHash - The SHA-256 of its token.
   * @param {Date} expiresAt - When it stops being trusted.
   * @returns {Promise<void>} Resolves once written.
   */
  public async insert(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.insert(trustedDevices).values({ userId, tokenHash, expiresAt });
  }

  /**
   * Method isTrusted
   *
   * @description
   * Whether the hash names a device of the account, still trusted at `now`.
   *
   * @param {string} userId - The account.
   * @param {string} tokenHash - The SHA-256 of the token.
   * @param {Date} now - The instant.
   * @returns {Promise<boolean>} `true` for a trusted device of the account.
   */
  public async isTrusted(userId: string, tokenHash: string, now: Date): Promise<boolean> {
    const rows: { id: string }[] = await this.db
      .select({ id: trustedDevices.id })
      .from(trustedDevices)
      .where(
        and(
          eq(trustedDevices.tokenHash, tokenHash),
          eq(trustedDevices.userId, userId),
          gt(trustedDevices.expiresAt, now),
        ),
      )
      .limit(1);
    return rows.length === 1;
  }

  /**
   * Method pruneOfUser
   *
   * @description
   * Deletes the devices of the account no longer trusted, and the trusted ones beyond the `keep`
   * that expire last, through the index on `user_id`.
   *
   * @param {string} userId - The account.
   * @param {Date} now - The instant.
   * @param {number} keep - How many trusted devices may stay.
   * @returns {Promise<void>} Resolves once deleted.
   */
  public async pruneOfUser(userId: string, now: Date, keep: number): Promise<void> {
    const kept = this.db
      .select({ id: trustedDevices.id })
      .from(trustedDevices)
      .where(and(eq(trustedDevices.userId, userId), gt(trustedDevices.expiresAt, now)))
      .orderBy(desc(trustedDevices.expiresAt), desc(trustedDevices.id))
      .limit(keep);
    await this.db
      .delete(trustedDevices)
      .where(
        and(
          eq(trustedDevices.userId, userId),
          or(lte(trustedDevices.expiresAt, now), notInArray(trustedDevices.id, kept)),
        ),
      );
  }

  /**
   * Method deleteOfUser
   *
   * @description
   * Deletes every device of the account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<number>} How many were deleted.
   */
  public async deleteOfUser(userId: string): Promise<number> {
    const deleted: { id: string }[] = await this.db
      .delete(trustedDevices)
      .where(eq(trustedDevices.userId, userId))
      .returning({ id: trustedDevices.id });
    return deleted.length;
  }
  // #endregion
}
