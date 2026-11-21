import { createHash } from 'node:crypto';

import type { TransactionScope } from '@cadenway/nest-common/database';
import { and, eq, sql } from 'drizzle-orm';

import type { FederatedConnection } from '../../../../../domain/value-objects/federated-sign-in/federated-connection.value-object.js';
import type { FederatedIdentity } from '../../../../../domain/value-objects/federated-sign-in/federated-identity.value-object.js';
import type { LinkedFederatedAccount } from '../../../../../domain/value-objects/federated-sign-in/linked-federated-account.value-object.js';
import { federatedAccountLinks } from '../../schemas/federated-sign-in/federated-account-link.schema.js';
import { samlAccountLinks } from '../../schemas/federated-sign-in/saml-account-link.schema.js';

type SamlConnection = Extract<FederatedConnection, { readonly provider: 'saml' }>;
type SocialConnection = Exclude<FederatedConnection, SamlConnection>;

function identityHash(identity: FederatedIdentity): string {
  return createHash('sha256')
    .update(JSON.stringify([identity.provider, identity.issuer, identity.subject]), 'utf8')
    .digest('hex');
}

function socialScope(connection: SocialConnection) {
  return and(
    eq(federatedAccountLinks.provider, connection.provider),
    eq(federatedAccountLinks.issuer, connection.issuer),
  );
}

function samlScope(connection: SamlConnection) {
  return and(
    eq(samlAccountLinks.organizationId, connection.organizationId),
    eq(samlAccountLinks.connectionId, connection.connectionId),
    eq(samlAccountLinks.issuer, connection.issuer),
  );
}

function toSocialLink(
  row: typeof federatedAccountLinks.$inferSelect | undefined,
): LinkedFederatedAccount | null {
  if (row === undefined) return null;
  if (row.provider === 'saml') throw new Error('An unscoped SAML account link cannot be used.');
  return {
    id: row.id,
    userId: row.userId,
    identity: { provider: row.provider, issuer: row.issuer, subject: row.subject },
    status: row.status,
  };
}

function toSamlLink(
  row: typeof samlAccountLinks.$inferSelect | undefined,
): LinkedFederatedAccount | null {
  if (row === undefined) return null;
  return {
    id: row.id,
    userId: row.userId,
    identity: {
      provider: 'saml',
      issuer: row.issuer,
      subject: row.subject,
      organizationId: row.organizationId,
      connectionId: row.connectionId,
    },
    status: row.status,
  };
}

/** Stores provider account links in the owning federated sign-in transaction. */
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
  /** Creates a unique provider identity within the verified authority's scope. */
  public async insert(
    userId: string,
    identity: FederatedIdentity,
  ): Promise<LinkedFederatedAccount | null> {
    const { provider, issuer, subject } = identity;
    const digest = identityHash(identity);
    if (provider === 'saml') {
      const { organizationId, connectionId } = identity;
      const [row] = await this.scope.db
        .insert(samlAccountLinks)
        .values({
          userId,
          organizationId,
          connectionId,
          issuer,
          subject,
          identityHash: digest,
          status: 'active',
        })
        .onConflictDoNothing({
          target: [
            samlAccountLinks.organizationId,
            samlAccountLinks.connectionId,
            samlAccountLinks.identityHash,
          ],
        })
        .returning();
      return toSamlLink(row);
    }
    const [row] = await this.scope.db
      .insert(federatedAccountLinks)
      .values({ userId, provider, issuer, subject, identityHash: digest, status: 'active' })
      .onConflictDoNothing({ target: federatedAccountLinks.identityHash })
      .returning();
    return toSocialLink(row);
  }

  /** Locks the exact provider identity, preserving issuer and subject case. */
  public async findByIdentity(identity: FederatedIdentity): Promise<LinkedFederatedAccount | null> {
    const digest = identityHash(identity);
    if (identity.provider === 'saml') {
      const [row] = await this.scope.db
        .select()
        .from(samlAccountLinks)
        .where(and(samlScope(identity), eq(samlAccountLinks.identityHash, digest)))
        .limit(1)
        .for('update');
      if (row !== undefined && row.subject !== identity.subject) {
        throw new Error('Federated identity digest collision.');
      }
      return toSamlLink(row);
    }
    const [row] = await this.scope.db
      .select()
      .from(federatedAccountLinks)
      .where(and(socialScope(identity), eq(federatedAccountLinks.identityHash, digest)))
      .limit(1)
      .for('update');
    if (row !== undefined && row.subject !== identity.subject) {
      throw new Error('Federated identity digest collision.');
    }
    return toSocialLink(row);
  }

  /** Locks a known account link in the authority scope of the continuation. */
  public async findById(
    userId: string,
    id: string,
    connection: FederatedConnection,
  ): Promise<LinkedFederatedAccount | null> {
    if (connection.provider === 'saml') {
      const [row] = await this.scope.db
        .select()
        .from(samlAccountLinks)
        .where(
          and(
            samlScope(connection),
            eq(samlAccountLinks.userId, userId),
            eq(samlAccountLinks.id, id),
          ),
        )
        .limit(1)
        .for('update');
      return toSamlLink(row);
    }
    const [row] = await this.scope.db
      .select()
      .from(federatedAccountLinks)
      .where(
        and(
          socialScope(connection),
          eq(federatedAccountLinks.userId, userId),
          eq(federatedAccountLinks.id, id),
        ),
      )
      .limit(1)
      .for('update');
    return toSocialLink(row);
  }

  /** Revokes a known binding without reassigning its provider identity. */
  public async revoke(
    userId: string,
    id: string,
    connection: FederatedConnection,
  ): Promise<boolean> {
    if (connection.provider === 'saml') {
      const rows = await this.scope.db
        .update(samlAccountLinks)
        .set({ status: 'revoked', updatedAt: sql`now()` })
        .where(
          and(
            samlScope(connection),
            eq(samlAccountLinks.userId, userId),
            eq(samlAccountLinks.id, id),
            eq(samlAccountLinks.status, 'active'),
          ),
        )
        .returning({ id: samlAccountLinks.id });
      return rows.length === 1;
    }
    const rows = await this.scope.db
      .update(federatedAccountLinks)
      .set({ status: 'revoked', updatedAt: sql`now()` })
      .where(
        and(
          socialScope(connection),
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
