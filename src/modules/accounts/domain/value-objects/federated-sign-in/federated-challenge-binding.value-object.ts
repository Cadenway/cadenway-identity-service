import type { FederatedConnection } from './federated-connection.value-object.js';

/** Identifies the existing provider link whose authority must still hold when MFA finishes. */
export interface FederatedChallengeBinding {
  // #region Properties
  /** The account link already verified at provider callback and receipt redemption. */
  readonly linkId: string;

  /** The exact provider connection that authenticated the first factor. */
  readonly connection: FederatedConnection;
  // #endregion
}
