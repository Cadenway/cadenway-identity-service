import type { FederatedConnection } from './federated-connection.value-object.js';

/** A proof from the provider adapter after verification against the flow's original connection. */
export interface VerifiedFederatedIdentity {
  // #region Properties
  /** The exact authority against which the adapter verified the proof. */
  readonly connection: FederatedConnection;
  readonly subject: string;
  // #endregion
}
