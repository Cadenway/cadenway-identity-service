import type { TransactionDatabase } from '@cadenway/nest-common/database';
import { eq, sql } from 'drizzle-orm';

import type { CodeRequestRepository } from '../../application/ports/account-repositories.port.js';
import { CodeRequestThrottle } from '../../domain/code-request-throttle.js';
import type { CodeRequestThrottleState } from '../../domain/code-request-throttle.js';
import type { EmailAddress } from '../../domain/email-address.js';
import codeRequests from './code-request.schema.js';

/**
 * Class DrizzleCodeRequestRepository
 *
 * @description
 * `CodeRequestRepository` on the `code_requests` table, in the transaction of its unit of work;
 * keyed by the normalized address.
 */
export class DrizzleCodeRequestRepository implements CodeRequestRepository {
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
   * Creates the row of the address when it is missing, then locks it and reads its throttle. Two
   * first requests at once both insert with `on conflict do nothing`; the second then waits on the
   * lock of the first. The row is never deleted, so a waiting request always finds it.
   *
   * @param {EmailAddress} email - The normalized address.
   * @returns {Promise<CodeRequestThrottle>} The throttle of the address.
   * @throws {Error} When the row is missing right after its insert, which never happens.
   */
  public async lock(email: EmailAddress): Promise<CodeRequestThrottle> {
    await this.db.insert(codeRequests).values({ email: email.value }).onConflictDoNothing();
    const rows: CodeRequestThrottleState[] = await this.db
      .select({
        lastRequestedAt: codeRequests.lastRequestedAt,
        windowStartedAt: codeRequests.windowStartedAt,
        windowRequests: codeRequests.windowRequests,
      })
      .from(codeRequests)
      .where(eq(codeRequests.email, email.value))
      .for('update');
    const row: CodeRequestThrottleState | undefined = rows[0];
    if (row === undefined) {
      throw new Error('The throttle row of a code request is missing after its insert.');
    }
    return CodeRequestThrottle.restore(row);
  }

  /**
   * Method save
   *
   * @description
   * Writes the throttle of the locked row after an accepted request.
   *
   * @param {EmailAddress} email - The normalized address.
   * @param {CodeRequestThrottle} throttle - The throttle after the request.
   * @returns {Promise<void>} Resolves once written.
   */
  public async save(email: EmailAddress, throttle: CodeRequestThrottle): Promise<void> {
    await this.db
      .update(codeRequests)
      .set({ ...throttle.snapshot, updatedAt: sql`now()` })
      .where(eq(codeRequests.email, email.value));
  }
  // #endregion
}
