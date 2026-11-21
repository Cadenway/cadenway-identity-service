import type { FederatedConnection } from '../../../../../domain/value-objects/federated-sign-in/federated-connection.value-object.js';
import type { VerifiedFederatedIdentity } from '../../../../../domain/value-objects/federated-sign-in/verified-federated-identity.value-object.js';

type SamlConnection = Extract<FederatedConnection, { readonly provider: 'saml' }>;

/** One server-configured SAML authority and its request and assertion operations. */
export interface SamlSignInConnection {
  // #region Properties
  /** The configured organization, connection and issuer. */
  readonly connection: SamlConnection;
  // #endregion

  // #region Methods
  /** Builds the HTTPS destination for the browser carrying the original request ID and RelayState. */
  authorizationUrl(requestId: string, relayState: string): Promise<URL>;

  /** Verifies the response only for the request selected by the durably claimed flow. */
  verify(input: {
    readonly requestId: string;
    readonly requestIssuedAt: Date;
    readonly samlResponse: string;
  }): Promise<
    | { readonly kind: 'verified'; readonly proof: VerifiedFederatedIdentity }
    | { readonly kind: 'refused' | 'unavailable' }
  >;
  // #endregion
}
