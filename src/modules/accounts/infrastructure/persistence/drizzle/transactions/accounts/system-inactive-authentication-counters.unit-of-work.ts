import type { SystemTransactionRunner, TransactionDatabase } from '@cadenway/nest-common/database';
import { inArray, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import type { InactiveAuthenticationCountersUnitOfWork } from '../../../../../application/ports/outbound/transactions/accounts/inactive-authentication-counters-unit-of-work.port.js';
import signInAttempts from '../../schemas/accounts/sign-in-attempt.schema.js';
import codeRequests from '../../schemas/authentication/code-request.schema.js';
import passwordResetRequests from '../../schemas/password-reset/password-reset-request.schema.js';

type CounterTable = typeof codeRequests | typeof signInAttempts | typeof passwordResetRequests;

/** Applies the retention cutoff using the PostgreSQL clock inside one system transaction. */
export class SystemInactiveAuthenticationCountersUnitOfWork implements InactiveAuthenticationCountersUnitOfWork {
  // #region Constructor
  /** Binds the system transaction runner owned by Identity. */
  public constructor(private readonly runner: SystemTransactionRunner) {}
  // #endregion

  // #region Methods
  /** Deletes only inactive counters that are available without waiting on requests. */
  public deleteBatch(limit: number): Promise<number> {
    return this.runner.run(async ({ db }) => {
      const signInInactive = sql`(${signInAttempts.lockedUntil} is null or
        ${signInAttempts.lockedUntil} <= transaction_timestamp())`;
      const codes = await this.deleteInactive(db, codeRequests, limit);
      const attempts = await this.deleteInactive(db, signInAttempts, limit, signInInactive);
      const resets = await this.deleteInactive(db, passwordResetRequests, limit);
      return codes + attempts + resets;
    });
  }

  /** Locks the candidate rows before deleting them, using the retention index. */
  private async deleteInactive(
    db: TransactionDatabase,
    table: CounterTable,
    limit: number,
    eligible: SQL = sql`true`,
  ): Promise<number> {
    const candidates = db.$with('inactive_counters').as(
      db
        .select({ email: table.email })
        .from(table)
        .where(
          sql`${table.updatedAt} <= transaction_timestamp() - interval '24 hours' and ${eligible}`,
        )
        .orderBy(table.updatedAt, table.email)
        .limit(limit)
        .for('update', { skipLocked: true }),
    );
    const result = await db
      .with(candidates)
      .delete(table)
      .where(inArray(table.email, db.select({ email: candidates.email }).from(candidates)));
    return result.rowCount ?? 0;
  }
  // #endregion
}
