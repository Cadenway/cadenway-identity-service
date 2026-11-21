import type { FederatedConnection } from './federated-connection.value-object.js';

/** Exact provider identity and authority scope of an existing link. */
export type FederatedIdentity = FederatedConnection & {
  /** The verified subject is opaque and case-sensitive. */
  readonly subject: string;
};
