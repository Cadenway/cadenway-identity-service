import type { FederatedSignInFlow } from '../../../../../domain/aggregates/federated-sign-in/federated-sign-in-flow.aggregate.js';
import type { FederatedIdentity } from '../../../../../domain/value-objects/federated-sign-in/federated-identity.value-object.js';
import type { FederatedConnection } from '../../../../../domain/value-objects/federated-sign-in/federated-connection.value-object.js';
import type { LinkedFederatedAccount } from '../../../../../domain/value-objects/federated-sign-in/linked-federated-account.value-object.js';

/** Repositories bound to one global Identity transaction. */
export interface SocialFlowStore {
  // #region Methods
  /** Allocates a flow identifier from the database in this transaction. */
  nextFlowId(): Promise<string>;

  /** Inserts an open flow under its unique state digest. */
  insert(flow: FederatedSignInFlow): Promise<void>;

  /** Locks the flow selected by its state digest until this transaction finishes. */
  findByStateHash(
    hash: string,
  ): Promise<{ readonly flow: FederatedSignInFlow; readonly version: number } | null>;

  /** Advances the locked phase only when its prior version still matches. */
  save(flow: FederatedSignInFlow, version: number): Promise<boolean>;

  /** Locks the exact existing social identity without email-based account matching. */
  findLink(identity: FederatedIdentity): Promise<LinkedFederatedAccount | null>;

  /** Locks and checks the account and current authority policy without bypassing MFA. */
  isEligible(userId: string, connection: FederatedConnection): Promise<boolean>;
  // #endregion
}
