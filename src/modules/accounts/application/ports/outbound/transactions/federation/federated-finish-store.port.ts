import type { FederatedSignInFlow } from '../../../../../domain/aggregates/federated-sign-in/federated-sign-in-flow.aggregate.js';
import type { FederatedConnection } from '../../../../../domain/value-objects/federated-sign-in/federated-connection.value-object.js';
import type { FederatedIdentity } from '../../../../../domain/value-objects/federated-sign-in/federated-identity.value-object.js';
import type { LinkedFederatedAccount } from '../../../../../domain/value-objects/federated-sign-in/linked-federated-account.value-object.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';

/** The locked receipt, account, membership and policy of one sign-in transaction. */
export interface FederatedFinishStore extends AccountsStore {
  // #region Methods
  /** Locks the flow selected by its continuation digest. */
  findByReceiptHash(
    hash: string,
  ): Promise<{ readonly flow: FederatedSignInFlow; readonly version: number } | null>;

  /** Saves the receipt transition in the current transaction. */
  save(flow: FederatedSignInFlow, version: number): Promise<boolean>;

  /** Locks and checks the exact provider identity link. */
  findLink(identity: FederatedIdentity): Promise<LinkedFederatedAccount | null>;

  /** Checks the current policy for this account and connection in the same transaction. */
  isAllowed(userId: string, connection: FederatedConnection): Promise<boolean>;

  /** Checks the current organization membership in the same transaction. */
  hasActiveMembership(userId: string, organizationId: string): Promise<boolean>;
  // #endregion
}
