import { createHash } from 'node:crypto';

import type { TransactionScope } from '@cadenway/nest-common/database';
import { and, eq, sql } from 'drizzle-orm';

import type { FederatedIdentity } from '../../../../../domain/value-objects/federated-sign-in/federated-identity.value-object.js';
import type { LinkedFederatedAccount } from '../../../../../domain/value-objects/federated-sign-in/linked-federated-account.value-object.js';
import { federatedAccountLinks } from '../../schemas/federated-sign-in/federated-account-link.schema.js';

function identityHash(identity: FederatedIdentity): string {
  return createHash('sha256')
    .update(JSON.stringify([identity.provider, identity.issuer, identity.subject]), 'utf8')
    .digest('hex');
}

function toLink(row: typeof federatedAccountLinks.$inferSelect): LinkedFederatedAccount {
  return {
    id: row.id,
    userId: row.userId,
    identity: { provider: row.provider, issuer: row.issuer, subject: row.subject },
    status: row.status,
  };
}

/** Stores exact provider bindings in an account-scoped system transaction. */
export class DrizzleFederatedAccountLinkRepository {
  // #region Constructor
  /** Binds the link queries to the current Identity transaction. */
  public constructor(private readonly scope: TransactionScope) {
    if (scope.kind !== 'system' || scope.organizationId !== null) {
      throw new Error('Federated account links require a system transaction.');
    }
  }
  // #endregion

  // #region Methods
  /** Creates a unique provider identity owned by the supplied account. */
  public async insert(
    userId: string,
    identity: FederatedIdentity,
  ): Promise<LinkedFederatedAccount | null> {
    const rows = await this.scope.db
      .insert(federatedAccountLinks)
      .values({ userId, ...identity, identityHash: identityHash(identity), status: 'active' })
      .onConflictDoNothing({ target: federatedAccountLinks.identityHash })
      .returning();
    return rows[0] === undefined ? null : toLink(rows[0]);
  }

  /** Locks the exact provider identity, preserving issuer and subject case. */
  public async findByIdentity(identity: FederatedIdentity): Promise<LinkedFederatedAccount | null> {
    const rows = await this.scope.db
      .select()
      .from(federatedAccountLinks)
      .where(eq(federatedAccountLinks.identityHash, identityHash(identity)))
      .limit(1)
      .for('update');
    const row = rows[0];
    if (row === undefined) return null;
    if (
      row.provider !== identity.provider ||
      row.issuer !== identity.issuer ||
      row.subject !== identity.subject
    ) {
      throw new Error('Federated identity digest collision.');
    }
    return toLink(row);
  }

  /** Locks a known link for the account whose authority is being rechecked. */
  public async findById(userId: string, id: string): Promise<LinkedFederatedAccount | null> {
    const rows = await this.scope.db
      .select()
      .from(federatedAccountLinks)
      .where(and(eq(federatedAccountLinks.userId, userId), eq(federatedAccountLinks.id, id)))
      .limit(1)
      .for('update');
    return rows[0] === undefined ? null : toLink(rows[0]);
  }

  /** Revokes a known account binding without reassigning its provider identity. */
  public async revoke(userId: string, id: string): Promise<boolean> {
    const rows = await this.scope.db
      .update(federatedAccountLinks)
      .set({ status: 'revoked', updatedAt: sql`now()` })
      .where(
        and(
          eq(federatedAccountLinks.userId, userId),
          eq(federatedAccountLinks.id, id),
          eq(federatedAccountLinks.status, 'active'),
        ),
      )
      .returning({ id: federatedAccountLinks.id });
    return rows.length === 1;
  }
  // #endregion
}
