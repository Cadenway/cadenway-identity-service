import type { TransactionDatabase } from '@cadenway/nest-common/database';
import { eq, sql } from 'drizzle-orm';

import type { OrganizationChoiceRepository } from '../../../../../application/ports/outbound/persistence/session/organization-choice-repository.port.js';
import organizationChoices from '../../schemas/session/organization-choice.schema.js';

/**
 * Class DrizzleOrganizationChoiceRepository
 *
 * @description
 * `OrganizationChoiceRepository` on the `organization_choices` table, in the system transaction of
 * its unit of work. Every query names the account, the primary key.
 */
export class DrizzleOrganizationChoiceRepository implements OrganizationChoiceRepository {
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
   * Reads the last organization the account chose.
   *
   * @param {string} userId - The account.
   * @returns {Promise<string | null>} The organization, or `null`.
   */
  public async find(userId: string): Promise<string | null> {
    const rows: { organizationId: string }[] = await this.db
      .select({ organizationId: organizationChoices.organizationId })
      .from(organizationChoices)
      .where(eq(organizationChoices.userId, userId))
      .limit(1);
    return rows[0]?.organizationId ?? null;
  }

  /**
   * Method remember
   *
   * @description
   * Inserts or replaces the choice of the account.
   *
   * @param {string} userId - The account.
   * @param {string} organizationId - The organization.
   * @returns {Promise<void>} Resolves once written.
   */
  public async remember(userId: string, organizationId: string): Promise<void> {
    await this.db
      .insert(organizationChoices)
      .values({ userId, organizationId })
      .onConflictDoUpdate({
        target: organizationChoices.userId,
        set: { organizationId, updatedAt: sql`now()` },
      });
  }

  /**
   * Method erase
   *
   * @description
   * Deletes the last choice of an account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves once deleted.
   */
  public async erase(userId: string): Promise<void> {
    await this.db.delete(organizationChoices).where(eq(organizationChoices.userId, userId));
  }
  // #endregion
}
