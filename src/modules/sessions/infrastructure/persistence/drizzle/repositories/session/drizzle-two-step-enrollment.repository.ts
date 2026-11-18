import type { TransactionDatabase } from '@cadenway/nest-common/database';
import { eq, sql } from 'drizzle-orm';

import type { TwoStepEnrollmentRepository } from '../../../../../application/ports/outbound/persistence/session/two-step-enrollment-repository.port.js';
import enrollments from '../../schemas/session/two-step-enrollment.schema.js';

/**
 * Class DrizzleTwoStepEnrollmentRepository
 *
 * @description
 * `TwoStepEnrollmentRepository` on `two_step_enrollments`, keyed by the account. The table has no
 * `organization_id` and no policy, so it is read the same way in the system and the tenant
 * transactions of the module.
 */
export class DrizzleTwoStepEnrollmentRepository implements TwoStepEnrollmentRepository {
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
   * Method isEnrolled
   *
   * @description
   * Whether the account has two-step verification.
   *
   * @param {string} userId - The account.
   * @returns {Promise<boolean>} `true` while it is on.
   */
  public async isEnrolled(userId: string): Promise<boolean> {
    const rows: { userId: string }[] = await this.db
      .select({ userId: enrollments.userId })
      .from(enrollments)
      .where(eq(enrollments.userId, userId))
      .limit(1);
    return rows.length === 1;
  }

  /**
   * Method enroll
   *
   * @description
   * Records the account, once.
   *
   * @param {string} userId - The account.
   * @param {Date} now - When two-step verification turned on.
   * @returns {Promise<void>} Resolves once written.
   */
  public async enroll(userId: string, now: Date): Promise<void> {
    await this.db.insert(enrollments).values({ userId, enabledAt: now }).onConflictDoNothing();
  }

  /**
   * Method unenroll
   *
   * @description
   * Removes the account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves once deleted.
   */
  public async unenroll(userId: string): Promise<void> {
    await this.db.delete(enrollments).where(eq(enrollments.userId, userId));
  }

  /**
   * Method enrolledAmong
   *
   * @description
   * The accounts of the list that have two-step verification, through the primary key. The list
   * travels as one array parameter (`= any($1::uuid[])`), so its length is not bounded by the
   * number of parameters of a statement.
   *
   * @param {readonly string[]} userIds - The accounts.
   * @returns {Promise<ReadonlySet<string>>} Those with two-step verification.
   */
  public async enrolledAmong(userIds: readonly string[]): Promise<ReadonlySet<string>> {
    if (userIds.length === 0) {
      return new Set<string>();
    }
    const rows: { userId: string }[] = await this.db
      .select({ userId: enrollments.userId })
      .from(enrollments)
      .where(sql`${enrollments.userId} = any(${sql.param([...userIds])}::uuid[])`);
    return new Set(rows.map((row: { userId: string }): string => row.userId));
  }
  // #endregion
}
