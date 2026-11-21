import { X509Certificate } from 'node:crypto';

import { SAML, ValidateInResponseTo } from '@node-saml/node-saml';

import type { SamlAssertionReplayGuard } from '../../../application/ports/outbound/federation/saml/saml-assertion-replay-guard.port.js';
import type { SamlSignInCatalog } from '../../../application/ports/outbound/federation/saml/saml-sign-in-catalog.port.js';
import type { SamlSignInConnection } from '../../../application/ports/outbound/federation/saml/saml-sign-in-connection.port.js';
import { parseSocialRedirectUri } from '../federated-sign-in/social-redirect-uri.js';
import type { SamlAssertionVerificationInput } from './saml-assertion-verification.input.js';
import { SamlAssertionVerifier } from './saml-assertion-verifier.adapter.js';
import type { SamlSignInConnectionConfig } from './saml-sign-in-connection.config.js';

const organizationUuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u;
const dnsLabel = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const redirectParameters = ['SAMLRequest', 'SAMLResponse', 'RelayState', 'SigAlg', 'Signature'];

function connectionKey(organizationId: string, connectionId: string): string {
  return JSON.stringify([organizationId, connectionId]);
}

function isVerifiedDomain(domain: string): boolean {
  return (
    domain.length <= 253 &&
    domain.includes('.') &&
    domain.split('.').every((label) => dnsLabel.test(label))
  );
}

function validateConfig(config: SamlSignInConnectionConfig): void {
  const entryPoint = URL.parse(config.entryPoint);
  if (
    !organizationUuid.test(config.organizationId) ||
    config.connectionId.trim() !== config.connectionId ||
    config.connectionId.length === 0 ||
    config.connectionId.length > 128 ||
    config.verifiedDomains.length === 0 ||
    !config.verifiedDomains.every(isVerifiedDomain) ||
    config.issuer.trim() !== config.issuer ||
    config.issuer.length === 0 ||
    config.issuer.length > 1024 ||
    config.serviceProviderEntityId.trim() !== config.serviceProviderEntityId ||
    config.serviceProviderEntityId.length === 0 ||
    config.serviceProviderEntityId.length > 1024 ||
    entryPoint?.href !== config.entryPoint ||
    entryPoint.protocol !== 'https:' ||
    entryPoint.username !== '' ||
    entryPoint.password !== '' ||
    config.entryPoint.includes('#') ||
    redirectParameters.some((key) => entryPoint.searchParams.has(key))
  ) {
    throw new TypeError('Invalid configured SAML connection.');
  }
  try {
    parseSocialRedirectUri(config.assertionConsumerUrl);
    new X509Certificate(config.idpCertificate);
  } catch {
    throw new TypeError('Invalid configured SAML callback or IdP certificate.');
  }
}

// A request cache exists only after its database-backed flow was claimed. Its single local
// verification can consume that request, while all processes share the durable assertion guard.
function claimedRequestCache(
  requestId: string,
  issuedAt: Date,
  recordAssertion: (key: string, expiresAt: Date) => Promise<boolean>,
): SamlAssertionVerificationInput['cache'] {
  let open = true;
  const publishedAt = issuedAt.toISOString();
  const read = (key: string | null) => (open && key === requestId ? publishedAt : null);
  const consume = (key: string | null) => {
    const value = read(key);
    if (value !== null) open = false;
    return value;
  };

  return {
    saveAsync: () => Promise.resolve(null),
    getAsync: (key) => Promise.resolve(read(key)),
    consumeAsync: (key) => Promise.resolve(consume(key)),
    removeAsync: (key) => Promise.resolve(consume(key) === null ? null : key),
    saveIfAbsentAsync: (key, _value, expiresAtMs) => recordAssertion(key, new Date(expiresAtMs)),
  };
}

function bindAuthority(
  config: SamlSignInConnectionConfig,
  replay: SamlAssertionReplayGuard,
  verifier: SamlAssertionVerifier,
): SamlSignInConnection {
  validateConfig(config);
  const {
    organizationId,
    connectionId,
    issuer,
    serviceProviderEntityId,
    assertionConsumerUrl,
    entryPoint,
    idpCertificate,
  } = config;
  const connection: SamlSignInConnection['connection'] = {
    provider: 'saml',
    organizationId,
    connectionId,
    issuer,
  };
  const binding = { connection, serviceProviderEntityId, assertionConsumerUrl, idpCertificate };

  return {
    connection,
    authorizationUrl: async (requestId, relayState) => {
      const sender = new SAML({
        entryPoint,
        issuer: serviceProviderEntityId,
        callbackUrl: assertionConsumerUrl,
        idpCert: idpCertificate,
        generateUniqueId: () => requestId,
        validateInResponseTo: ValidateInResponseTo.never,
        identifierFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
        allowCreate: false,
        disableRequestedAuthnContext: true,
      });
      const authorizationUrl = new URL(await sender.getAuthorizeUrlAsync(relayState, {}));
      if (authorizationUrl.href.length > 8192) throw new TypeError('SAML redirect is too long.');
      return authorizationUrl;
    },
    verify: ({ requestId, requestIssuedAt, samlResponse }) =>
      verifier.verify({
        connection,
        requestId,
        samlResponse,
        binding,
        cache: claimedRequestCache(requestId, requestIssuedAt, (key, expiresAt) =>
          replay.claim(connection, key, expiresAt),
        ),
      }),
  };
}

/** Holds only server-provisioned, uniquely assigned verified domains and tenant bindings. */
export class ConfiguredSamlSignInCatalog implements SamlSignInCatalog {
  // #region Properties
  /** Routes verified domains to a uniquely provisioned authority. */
  private readonly byDomain = new Map<string, SamlSignInConnection>();

  /** Loads the authority named by an existing flow. */
  private readonly byConnection = new Map<string, SamlSignInConnection>();
  // #endregion

  // #region Constructor
  /** Validates configuration once and refuses ambiguous SAML domain or connection mappings. */
  public constructor(
    configs: readonly SamlSignInConnectionConfig[],
    replay: SamlAssertionReplayGuard,
  ) {
    const verifier = new SamlAssertionVerifier();
    for (const config of configs) {
      const authority = bindAuthority(config, replay, verifier);
      const key = connectionKey(config.organizationId, config.connectionId);
      if (this.byConnection.has(key)) throw new TypeError('Duplicate configured SAML connection.');
      this.byConnection.set(key, authority);
      for (const domain of config.verifiedDomains) {
        if (this.byDomain.has(domain)) throw new TypeError('Ambiguous verified SAML domain.');
        this.byDomain.set(domain, authority);
      }
    }
  }
  // #endregion

  // #region Methods
  /** Returns the authority only for a configured verified work domain. */
  public findByVerifiedDomain(domain: string): SamlSignInConnection | null {
    return this.byDomain.get(domain) ?? null;
  }

  /** Uses the persisted organization, connection and issuer and detects stale configuration. */
  public findByConnection(
    connection: SamlSignInConnection['connection'],
  ): SamlSignInConnection | null {
    const authority = this.byConnection.get(
      connectionKey(connection.organizationId, connection.connectionId),
    );
    return authority?.connection.issuer === connection.issuer ? authority : null;
  }
  // #endregion
}
