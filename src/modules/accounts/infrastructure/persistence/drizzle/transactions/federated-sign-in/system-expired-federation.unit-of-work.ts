import type { SystemTransactionRunner } from '@cadenway/nest-common/database';
import { asc, inArray, lte, sql } from 'drizzle-orm';

import type { ExpiredFederationUnitOfWork } from '../../../../../application/ports/outbound/transactions/federation/expired-federation-unit-of-work.port.js';
import type { PurgeExpiredFederationOutput } from '../../../../../application/use-cases/commands/federated-sign-in/purge-expired-federation/purge-expired-federation.output.js';
import { federatedSignInFlows } from '../../schemas/federated-sign-in/federated-sign-in-flow.schema.js';
import { samlAssertionReplays } from '../../schemas/federated-sign-in/saml-assertion-replay.schema.js';

/** Uses the system runner for indexed federation maintenance across all organizations. */
export class SystemExpiredFederationUnitOfWork implements ExpiredFederationUnitOfWork {
  // #region Constructor
  /** Binds the system transaction runner owned by Identity. */
  public constructor(private readonly runner: SystemTransactionRunner) {}
  // #endregion

  // #region Methods
  /** Deletes only the indexed rows past their deadline, leaving concurrent callbacks alone. */
  public deleteBatch(limit: number): Promise<PurgeExpiredFederationOutput> {
    return this.runner.run(async ({ db }) => {
      const now = sql`transaction_timestamp()`;
      const flows = federatedSignInFlows;
      const assertions = samlAssertionReplays;
      const expiredFlows = db
        .$with('expired_flows')
        .as(
          db
            .select({ id: flows.id })
            .from(flows)
            .where(lte(flows.expiresAt, now))
            .orderBy(asc(flows.expiresAt), asc(flows.id))
            .limit(limit)
            .for('update', { skipLocked: true }),
        );
      const expiredAssertions = db
        .$with('expired_assertions')
        .as(
          db
            .select({ id: assertions.id })
            .from(assertions)
            .where(lte(assertions.expiresAt, now))
            .orderBy(asc(assertions.expiresAt), asc(assertions.id))
            .limit(limit)
            .for('update', { skipLocked: true }),
        );
      const deletedFlows = await db
        .with(expiredFlows)
        .delete(flows)
        .where(inArray(flows.id, db.select({ id: expiredFlows.id }).from(expiredFlows)));
      // The replay guard stores a deadline that already includes its safety margin.
      const deletedAssertions = await db
        .with(expiredAssertions)
        .delete(assertions)
        .where(
          inArray(assertions.id, db.select({ id: expiredAssertions.id }).from(expiredAssertions)),
        );
      return { flows: deletedFlows.rowCount ?? 0, assertions: deletedAssertions.rowCount ?? 0 };
    });
  }
  // #endregion
}
