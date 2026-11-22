import type { FederatedIdentity } from './federated-identity.value-object.js';

/** A durable local account link selected by the subject and its verified identity authority. */
export interface LinkedFederatedAccount {
  // #region Properties
  /** Immutable link identity that changes when a link is replaced. */
  readonly id: string;
  readonly userId: string;
  readonly identity: FederatedIdentity;
  readonly status: 'active' | 'revoked';
  // #endregion
}
