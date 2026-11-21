import { SAML, ValidateInResponseTo } from '@node-saml/node-saml';

import type { VerifiedFederatedIdentity } from '../../../domain/value-objects/federated-sign-in/verified-federated-identity.value-object.js';
import type { SamlAssertionVerificationInput } from './saml-assertion-verification.input.js';
import {
  checkSamlPostEnvelope,
  readVerifiedSamlSubject,
  samlAssertionMaxAgeMs,
  samlClockSkewMs,
} from './saml-post-profile.js';

type Verification =
  | { readonly kind: 'verified'; readonly proof: VerifiedFederatedIdentity }
  | { readonly kind: 'refused' | 'unavailable' };

type AtomicCache = SamlAssertionVerificationInput['cache'];

class ReplayCacheUnavailableError extends Error {}

async function cacheCall<Result>(run: () => Promise<Result>): Promise<Result> {
  try {
    return await run();
  } catch {
    throw new ReplayCacheUnavailableError('The SAML replay cache is unavailable.');
  }
}

function protectedCache(cache: AtomicCache, requestId: string): AtomicCache {
  return {
    saveAsync: () => Promise.resolve(null),
    getAsync: (key) =>
      key === requestId ? cacheCall(() => cache.getAsync(key)) : Promise.resolve(null),
    // The verifier can retire a signed request on failure. It may only retire this flow's ID.
    removeAsync: (key) =>
      key === requestId ? cacheCall(() => cache.removeAsync(key)) : Promise.resolve(null),
    consumeAsync: (key) =>
      key === requestId ? cacheCall(() => cache.consumeAsync(key)) : Promise.resolve(null),
    saveIfAbsentAsync: (key, value, expiry) =>
      cacheCall(() => cache.saveIfAbsentAsync(key, value, expiry)),
  };
}

/** Verifies a SAML POST response for the original SP-initiated request and organization connection. */
export class SamlAssertionVerifier {
  // #region Methods
  /** Returns the linked identity input or a privacy-preserving refusal or dependency failure. */
  public async verify(input: SamlAssertionVerificationInput): Promise<Verification> {
    const { connection, binding, cache, samlResponse } = input;
    if (
      binding.connection.organizationId !== connection.organizationId ||
      binding.connection.connectionId !== connection.connectionId ||
      binding.connection.issuer !== connection.issuer
    ) {
      return { kind: 'refused' };
    }
    if (typeof cache.consumeAsync !== 'function' || typeof cache.saveIfAbsentAsync !== 'function') {
      return { kind: 'unavailable' };
    }
    try {
      const now = Date.now();
      const expectedSubject = checkSamlPostEnvelope(input, now);
      const verifier = new SAML({
        issuer: binding.serviceProviderEntityId,
        audience: binding.serviceProviderEntityId,
        idpIssuer: connection.issuer,
        idpCert: binding.idpCertificate,
        callbackUrl: binding.assertionConsumerUrl,
        signatureAlgorithm: 'sha256',
        digestAlgorithm: 'sha256',
        wantAssertionsSigned: true,
        wantAuthnResponseSigned: true,
        validateInResponseTo: ValidateInResponseTo.always,
        rejectReplayedAssertions: true,
        acceptedClockSkewMs: samlClockSkewMs,
        maxAssertionAgeMs: samlAssertionMaxAgeMs,
        requestIdExpirationPeriodMs: 10 * 60_000,
        cacheProvider: protectedCache(cache, input.requestId),
      });
      const result = await verifier.validatePostResponseAsync({ SAMLResponse: samlResponse });
      const verifiedXml = result.profile?.getAssertionXml?.();
      if (result.loggedOut || verifiedXml === undefined) return { kind: 'refused' };
      const subject = readVerifiedSamlSubject(verifiedXml, input, Date.now());
      if (subject !== expectedSubject) return { kind: 'refused' };
      return { kind: 'verified', proof: { connection, subject } };
    } catch (error) {
      return { kind: error instanceof ReplayCacheUnavailableError ? 'unavailable' : 'refused' };
    }
  }
  // #endregion
}
