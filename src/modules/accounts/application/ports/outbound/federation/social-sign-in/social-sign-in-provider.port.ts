import type { FederatedConnection } from '../../../../../domain/value-objects/federated-sign-in/federated-connection.value-object.js';
import type { VerifiedFederatedIdentity } from '../../../../../domain/value-objects/federated-sign-in/verified-federated-identity.value-object.js';

/** A configured social provider for authorization code sign-in. */
export interface SocialSignInProvider {
  // #region Properties
  /** Authority to bind to the flow before issuing a redirect. */
  readonly connection: FederatedConnection & {
    readonly provider: Exclude<FederatedConnection['provider'], 'saml'>;
  };
  // #endregion

  // #region Methods
  /** Builds a redirect to the configured provider with per-flow S256 PKCE parameters. */
  authorizationUrl(input: {
    readonly state: string;
    readonly pkceChallenge: string;
    readonly nonce: string;
  }): URL;

  /**
   * Exchanges the code outside a transaction, after the caller has atomically claimed its state
   * and browser binding. The verifier and nonce belong to that claimed flow.
   */
  verify(input: {
    readonly code: string;
    readonly state: string;
    readonly pkceVerifier: string;
    readonly nonce: string;
  }): Promise<VerifiedFederatedIdentity>;
  // #endregion
}
