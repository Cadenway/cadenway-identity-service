import type { CacheProvider } from '@node-saml/node-saml';

import type { FederatedConnection } from '../../../domain/value-objects/federated-sign-in/federated-connection.value-object.js';

type SamlConnection = Extract<FederatedConnection, { readonly provider: 'saml' }>;

/** Verifies a browser response using the connection and request selected by the claimed flow. */
export interface SamlAssertionVerificationInput {
  // #region Properties
  /** The original SAML connection stored with the one-use flow. */
  readonly connection: SamlConnection;

  /** The expected AuthnRequest identifier generated before redirecting the browser. */
  readonly requestId: string;

  /** The HTTP-POST response value after form decoding. */
  readonly samlResponse: string;

  /** A trusted server-side binding, loaded independently of the provider response. */
  readonly binding: {
    readonly connection: SamlConnection;
    readonly idpCertificate: string;
    readonly serviceProviderEntityId: string;
    readonly assertionConsumerUrl: string;
  };

  /** A durable cache scoped to the organization and connection, with atomic request and assertion operations. */
  readonly cache: CacheProvider &
    Required<Pick<CacheProvider, 'consumeAsync' | 'saveIfAbsentAsync'>>;
  // #endregion
}
