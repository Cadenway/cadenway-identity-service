import type { TransactionScope } from '@cadenway/nest-common/database';
import { and, eq, isNull, sql } from 'drizzle-orm';

import { FederatedSignInFlow } from '../../../../../domain/aggregates/federated-sign-in/federated-sign-in-flow.aggregate.js';
import { federatedSignInFlows } from '../../schemas/federated-sign-in/federated-sign-in-flow.schema.js';

/** Persists browser-bound sign-in state inside an owning system transaction. */
export class DrizzleFederatedSignInFlowRepository {
  // #region Constructor
  /** Binds every operation to the transaction that also performs the sign-in decision. */
  public constructor(private readonly scope: TransactionScope) {
    if (scope.kind !== 'system' || scope.organizationId !== null) {
      throw new Error('Federated sign-in requires a system transaction.');
    }
  }
  // #endregion

  // #region Methods
  /** Inserts a fresh flow. Its caller supplies an opaque UUID and hashed browser credentials. */
  public async insert(flow: FederatedSignInFlow): Promise<void> {
    const state = flow.snapshot;
    if (state.phase.kind !== 'open')
      throw new Error('Only an open federated flow can be inserted.');
    await this.scope.db.insert(federatedSignInFlows).values({
      id: state.id,
      stateHash: state.stateHash,
      state,
      expiresAt: new Date(state.expiresAtMs),
    });
  }

  /** Locks a flow selected by the callback state digest. */
  public async findByStateHash(
    stateHash: string,
  ): Promise<{ flow: FederatedSignInFlow; version: number } | null> {
    const rows = await this.scope.db
      .select()
      .from(federatedSignInFlows)
      .where(eq(federatedSignInFlows.stateHash, stateHash))
      .limit(1)
      .for('update');
    return this.restore(rows[0]);
  }

  /** Locks a flow selected by the single-use continuation digest. */
  public async findByReceiptHash(
    receiptHash: string,
  ): Promise<{ flow: FederatedSignInFlow; version: number } | null> {
    const rows = await this.scope.db
      .select()
      .from(federatedSignInFlows)
      .where(eq(federatedSignInFlows.receiptHash, receiptHash))
      .limit(1)
      .for('update');
    return this.restore(rows[0]);
  }

  /** Advances one phase with compare-and-swap, leaving competing attempts unable to overwrite it. */
  public async save(flow: FederatedSignInFlow, version: number): Promise<boolean> {
    const state = flow.snapshot;
    const phase = state.phase;
    if (phase.kind === 'open') throw new Error('An issued flow cannot replace a stored flow.');
    const redeemed = phase.kind === 'complete' && phase.continuation.redeemedAtMs !== null;
    const previous = phase.kind === 'claimed' ? 'open' : redeemed ? 'complete' : 'claimed';
    const receiptHash = phase.kind === 'complete' ? phase.continuation.receiptHash : null;
    const rows = await this.scope.db
      .update(federatedSignInFlows)
      .set({
        state,
        receiptHash,
        expiresAt: new Date(
          phase.kind === 'complete'
            ? Math.max(state.expiresAtMs, phase.continuation.expiresAtMs)
            : state.expiresAtMs,
        ),
        version: sql`${federatedSignInFlows.version} + 1`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(federatedSignInFlows.id, state.id),
          eq(federatedSignInFlows.stateHash, state.stateHash),
          eq(federatedSignInFlows.version, version),
          sql`(${federatedSignInFlows.state}::jsonb - 'phase'::text) = (${JSON.stringify(state)}::jsonb - 'phase'::text)`,
          sql`${federatedSignInFlows.state}::jsonb->'phase'::text->>'kind'::text = ${previous}::text`,
          redeemed
            ? eq(federatedSignInFlows.receiptHash, receiptHash ?? '')
            : isNull(federatedSignInFlows.receiptHash),
          redeemed
            ? sql`${federatedSignInFlows.state}::jsonb->'phase'::text->'continuation'::text->>'redeemedAtMs'::text is null`
            : undefined,
          redeemed
            ? sql`(((${federatedSignInFlows.state}::jsonb -> 'phase'::text) -> 'continuation'::text) - 'redeemedAtMs'::text) = (${JSON.stringify(phase.continuation)}::jsonb - 'redeemedAtMs'::text)`
            : undefined,
        ),
      )
      .returning({ id: federatedSignInFlows.id });
    return rows.length === 1;
  }

  /** Restores only internally consistent indexed state. */
  private restore(
    row: typeof federatedSignInFlows.$inferSelect | undefined,
  ): { flow: FederatedSignInFlow; version: number } | null {
    if (row === undefined) return null;
    const flow = FederatedSignInFlow.restore(row.state);
    const state = flow.snapshot;
    const receiptHash =
      state.phase.kind === 'complete' ? state.phase.continuation.receiptHash : null;
    if (
      state.id !== row.id ||
      state.stateHash !== row.stateHash ||
      receiptHash !== row.receiptHash
    ) {
      throw new Error('Stored federated flow indexes do not match its state.');
    }
    return { flow, version: row.version };
  }
  // #endregion
}
