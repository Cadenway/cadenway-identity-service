import { createHash } from 'node:crypto';

import { assertNoActiveTransaction } from '@cadenway/nest-common/database';
import type { SystemTransactionRunner } from '@cadenway/nest-common/database';
import { lte, sql } from 'drizzle-orm';

import type { SamlAssertionReplayGuard } from '../../../../../application/ports/outbound/federation/saml/saml-assertion-replay-guard.port.js';
import type { SamlSignInConnection } from '../../../../../application/ports/outbound/federation/saml/saml-sign-in-connection.port.js';
import { samlAssertionReplays } from '../../schemas/federated-sign-in/saml-assertion-replay.schema.js';

// Keep markers beyond the verifier's latest acceptance time to tolerate a boundary clock step.
const retentionMarginMs = 60_000;
const expiredBatchSize = 32;

/** Shares the SAML assertion replay decision across concurrent callbacks and Identity instances. */
export class DrizzleSamlAssertionReplayGuard implements SamlAssertionReplayGuard {
  // #region Constructor
  /** Binds the system runner used by a callback whose claimed flow proves the tenant. */
  public constructor(private readonly runner: SystemTransactionRunner) {}
  // #endregion

  // #region Methods
  /** Records a digest once and amortizes expiry cleanup in bounded, connection-scoped batches. */
  public claim(
    connection: SamlSignInConnection['connection'],
    assertionKey: string,
    expiresAt: Date,
  ): Promise<boolean> {
    assertNoActiveTransaction();
    const { organizationId, connectionId } = connection;
    const keyHash = createHash('sha256').update(assertionKey).digest('hex');
    const retainedUntil = new Date(expiresAt.getTime() + retentionMarginMs);
    return this.runner.run(async ({ db }) => {
      const markers = samlAssertionReplays;
      const inserted = await db
        .insert(markers)
        .values({ organizationId, connectionId, keyHash, expiresAt: retainedUntil })
        .onConflictDoUpdate({
          target: [markers.organizationId, markers.connectionId, markers.keyHash],
          set: { expiresAt: retainedUntil },
          setWhere: lte(markers.expiresAt, sql`statement_timestamp()`),
        })
        .returning({ id: markers.id });
      await db.execute(sql`
        delete from ${markers}
        where ${markers.organizationId} = ${organizationId} and ${markers.connectionId} = ${connectionId}
          and ${markers.id} in (
            select ${markers.id} from ${markers}
            where ${markers.organizationId} = ${organizationId}
              and ${markers.connectionId} = ${connectionId}
              and ${markers.expiresAt} <= statement_timestamp()
            order by ${markers.expiresAt}
            limit ${expiredBatchSize}
            for update skip locked
          )
      `);
      return inserted.length === 1;
    });
  }
  // #endregion
}
