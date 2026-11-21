import type { FederatedConnection } from './federated-connection.value-object.js';

/** Exact provider identity of an existing link. The verified subject is opaque and case-sensitive. */
export interface FederatedIdentity {
  // #region Properties
  /** Configured provider from which Identity accepted the proof. */
  readonly provider: FederatedConnection['provider'];
  readonly issuer: string;
  readonly subject: string;
  // #endregion
}
