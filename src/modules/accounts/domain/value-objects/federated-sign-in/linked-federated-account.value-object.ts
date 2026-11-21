import type { FederatedIdentity } from './federated-identity.value-object.js';

/** A durable link to one local account, selected using the verified provider, issuer and subject. */
export interface LinkedFederatedAccount {
  // #region Properties
  /** Immutable link identity that changes when a link is replaced. */
  readonly id: string;
  readonly userId: string;
  readonly identity: FederatedIdentity;
  readonly status: 'active' | 'revoked';
  // #endregion
}
