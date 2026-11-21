/** Provisioned SAML binding for an organization and the work domains already verified for it. */
export interface SamlSignInConnectionConfig {
  // #region Properties
  /** The organization for which this authority is allowed to assert identities. */
  readonly organizationId: string;

  /** The stable Identity connection identifier within that organization. */
  readonly connectionId: string;

  /** Canonical domains verified for that organization before provisioning. */
  readonly verifiedDomains: readonly string[];

  /** Exact entity ID in signed assertions. */
  readonly issuer: string;

  /** HTTPS endpoint receiving SP-initiated authentication requests. */
  readonly entryPoint: string;

  /** Pinned signing certificate of the IdP. */
  readonly idpCertificate: string;

  /** Audience bound to this service provider. */
  readonly serviceProviderEntityId: string;

  /** The gateway's SAML POST callback URL. */
  readonly assertionConsumerUrl: string;
  // #endregion
}
