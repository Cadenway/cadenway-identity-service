import { generateKeyPairSync, sign } from 'node:crypto';
import type { KeyObject } from 'node:crypto';

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SignedXml } from 'xml-crypto';

import type { SamlAssertionVerificationInput } from './saml-assertion-verification.input.js';
import { SamlAssertionVerifier } from './saml-assertion-verifier.adapter.js';

const connection = {
  provider: 'saml',
  organizationId: 'atelier-nord',
  connectionId: 'atelier-nord-sso',
  issuer: 'https://idp.example.test/atelier-nord',
} as const;
const callbackUrl = 'https://api.example.test/v1/auth/sign-in/federated/saml/callback';
const serviceProvider = 'https://api.example.test/saml';
const requestId = '_atelier-nord-saml-request';
const assertionId = '_atelier-nord-saml-assertion';
const subject = 'Employee.Camille-42';
const saml2 = 'urn:oasis:names:tc:SAML:2.0';
const xmlSignature = 'http://www.w3.org/2000/09/xmldsig#';
const rsaSha256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const sha256 = 'http://www.w3.org/2001/04/xmlenc#sha256';
const exclusiveCanonicalization = 'http://www.w3.org/2001/10/xml-exc-c14n#';

interface TestIdp {
  // #region Properties
  /** Synthetic IdP trust anchor. */
  readonly certificate: string;

  /** In-memory signing key corresponding to the certificate. */
  readonly key: KeyObject;
  // #endregion
}

interface PostOptions {
  // #region Properties
  /** Destination on the response envelope. */
  readonly destination?: string;

  /** Recipient on the assertion's bearer confirmation. */
  readonly recipient?: string;

  /** Issuer on the response and assertion. */
  readonly issuer?: string;

  /** Service-provider audience of the assertion. */
  readonly audience?: string;

  /** Request ID returned by the envelope. */
  readonly request?: string;

  /** Request ID returned by the bearer confirmation. */
  readonly confirmationRequest?: string;

  /** UTC issue time of the response and assertion. */
  readonly issueTime?: string;

  /** UTC expiration of the bearer confirmation. */
  readonly confirmationExpiry?: string;

  /** XML signature algorithm for the fixture signatures. */
  readonly signatureAlgorithm?: string;

  /** XML digest algorithm for the fixture references. */
  readonly digestAlgorithm?: string;

  /** Whether to include a signature on the assertion. */
  readonly signAssertion?: boolean;

  /** Whether to include a signature on the response. */
  readonly signResponse?: boolean;
  // #endregion
}

function der(tag: number, ...parts: Buffer[]): Buffer {
  const data = Buffer.concat(parts);
  const length =
    data.length < 128
      ? [data.length]
      : data.length < 256
        ? [0x81, data.length]
        : [0x82, data.length >>> 8, data.length & 0xff];
  return Buffer.concat([Buffer.from([tag, ...length]), data]);
}

// The verifier takes an X.509 certificate. Build the synthetic self-signed certificate in memory.
function createTestIdp(): TestIdp {
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const algorithm = Buffer.from('300d06092a864886f70d01010b0500', 'hex');
  const commonName = der(
    0x30,
    Buffer.from('0603550403', 'hex'),
    der(0x0c, Buffer.from('Test IdP')),
  );
  const name = der(0x30, der(0x31, commonName));
  const validDates = der(
    0x30,
    der(0x18, Buffer.from('20200101000000Z')),
    der(0x18, Buffer.from('20991231235959Z')),
  );
  const body = der(
    0x30,
    Buffer.from('a003020102020101', 'hex'),
    algorithm,
    name,
    validDates,
    name,
    keys.publicKey.export({ format: 'der', type: 'spki' }),
  );
  const fingerprint = sign('sha256', body, keys.privateKey);
  const certificate = der(0x30, body, algorithm, der(0x03, Buffer.from([0]), fingerprint));
  return {
    certificate: `-----BEGIN CERTIFICATE-----\n${certificate.toString('base64')}\n-----END CERTIFICATE-----`,
    key: keys.privateKey,
  };
}

function signedXml(xml: string, localName: string, key: KeyObject, options: PostOptions): string {
  const signer = new SignedXml({
    privateKey: key,
    signatureAlgorithm: options.signatureAlgorithm ?? rsaSha256,
    canonicalizationAlgorithm: exclusiveCanonicalization,
  });
  const root = `/*[local-name(.)='${localName}']`;
  signer.addReference({
    xpath: root,
    transforms: [`${xmlSignature}enveloped-signature`, exclusiveCanonicalization],
    digestAlgorithm: options.digestAlgorithm ?? sha256,
  });
  signer.computeSignature(xml, {
    location: { reference: `${root}/*[local-name(.)='Issuer']`, action: 'after' },
  });
  return signer.getSignedXml();
}

function signedPost(idp: TestIdp, options: PostOptions = {}): string {
  const now = Date.now();
  const issueTime = options.issueTime ?? new Date(now - 10_000).toISOString();
  const expiry = new Date(now + 120_000).toISOString();
  const request = options.request ?? requestId;
  const issuer = options.issuer ?? connection.issuer;
  const assertion = `<saml:Assertion xmlns:saml="${saml2}:assertion" ID="${assertionId}" Version="2.0" IssueInstant="${issueTime}">
    <saml:Issuer>${issuer}</saml:Issuer>
    <saml:Subject>
      <saml:NameID>${subject}</saml:NameID>
      <saml:SubjectConfirmation Method="${saml2}:cm:bearer">
        <saml:SubjectConfirmationData Recipient="${options.recipient ?? callbackUrl}" InResponseTo="${options.confirmationRequest ?? request}" NotOnOrAfter="${options.confirmationExpiry ?? expiry}"/>
      </saml:SubjectConfirmation>
    </saml:Subject>
    <saml:Conditions NotBefore="${issueTime}" NotOnOrAfter="${expiry}">
      <saml:AudienceRestriction><saml:Audience>${options.audience ?? serviceProvider}</saml:Audience></saml:AudienceRestriction>
    </saml:Conditions>
    <saml:AuthnStatement AuthnInstant="${issueTime}">
      <saml:AuthnContext><saml:AuthnContextClassRef>${saml2}:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext>
    </saml:AuthnStatement>
    <saml:AttributeStatement><saml:Attribute Name="email"><saml:AttributeValue>person@example.test</saml:AttributeValue></saml:Attribute></saml:AttributeStatement>
  </saml:Assertion>`;
  const response = `<samlp:Response xmlns:samlp="${saml2}:protocol" xmlns:saml="${saml2}:assertion" ID="_saml-response" Version="2.0" IssueInstant="${issueTime}" Destination="${options.destination ?? callbackUrl}" InResponseTo="${request}">
    <saml:Issuer>${issuer}</saml:Issuer>
    <samlp:Status><samlp:StatusCode Value="${saml2}:status:Success"/></samlp:Status>
    ${options.signAssertion === false ? assertion : signedXml(assertion, 'Assertion', idp.key, options)}
  </samlp:Response>`;
  return Buffer.from(
    options.signResponse === false ? response : signedXml(response, 'Response', idp.key, options),
  ).toString('base64');
}

function replayCache(...requests: string[]) {
  const issuedAt = new Date(Date.now() - 30_000).toISOString();
  const pending = new Map(requests.map((request) => [request, issuedAt]));
  const acceptedAssertions = new Map<string, number>();
  const consume = (key: string | null): string | null => {
    if (key === null) return null;
    const value = pending.get(key) ?? null;
    pending.delete(key);
    return value;
  };
  return {
    saveAsync: vi.fn(() => Promise.resolve(null)),
    getAsync: vi.fn((key: string) => Promise.resolve(pending.get(key) ?? null)),
    removeAsync: vi.fn((key: string | null) => Promise.resolve(consume(key))),
    consumeAsync: vi.fn((key: string) => Promise.resolve(consume(key))),
    saveIfAbsentAsync: vi.fn((key: string, _value: string, expiresAt: number) => {
      const priorExpiry = acceptedAssertions.get(key);
      if (priorExpiry !== undefined && priorExpiry > Date.now()) return Promise.resolve(false);
      acceptedAssertions.set(key, expiresAt);
      return Promise.resolve(true);
    }),
  } satisfies SamlAssertionVerificationInput['cache'];
}

describe('SamlAssertionVerifier', () => {
  const verifier = new SamlAssertionVerifier();
  let idp: TestIdp;
  let otherIdp: TestIdp;

  beforeAll(() => {
    idp = createTestIdp();
    otherIdp = createTestIdp();
  });

  function input(
    options: PostOptions = {},
    cache = replayCache(requestId),
  ): SamlAssertionVerificationInput {
    return {
      connection,
      requestId,
      samlResponse: signedPost(idp, options),
      binding: {
        connection,
        idpCertificate: idp.certificate,
        serviceProviderEntityId: serviceProvider,
        assertionConsumerUrl: callbackUrl,
      },
      cache,
    };
  }

  it('returns only the signed opaque subject and original organization connection', async () => {
    const cache = replayCache(requestId);
    const request = input({}, cache);
    await expect(verifier.verify(request)).resolves.toEqual({
      kind: 'verified',
      proof: { connection, subject },
    });
    expect(cache.consumeAsync).toHaveBeenCalledExactlyOnceWith(requestId);
    expect(cache.saveIfAbsentAsync).toHaveBeenCalledOnce();
  });

  it.each([
    ['another organization', { organizationId: 'atelier-sud' }],
    ['a replaced connection', { connectionId: 'replaced-sso' }],
    ['a changed issuer', { issuer: 'https://idp.example.test/atelier-sud' }],
  ])('refuses a binding for %s before accessing the replay store', async (_label, patch) => {
    const cache = replayCache(requestId);
    const request = input({}, cache);
    await expect(
      verifier.verify({
        ...request,
        binding: { ...request.binding, connection: { ...connection, ...patch } },
      }),
    ).resolves.toEqual({ kind: 'refused' });
    expect(cache.getAsync).not.toHaveBeenCalled();
  });

  it.each([
    ['another destination', { destination: 'https://api.example.test/other' }],
    ['another bearer recipient', { recipient: 'https://api.example.test/other' }],
    ['another audience', { audience: 'https://api.example.test/other' }],
    ['another issuer', { issuer: 'https://idp.example.test/other' }],
    ['another request', { request: '_other' }],
    ['another bearer request', { confirmationRequest: '_other' }],
    ['an unsigned assertion', { signAssertion: false }],
    ['an unsigned response', { signResponse: false }],
    ['an inbound SHA-1 signature', { signatureAlgorithm: `${xmlSignature}rsa-sha1` }],
    ['an inbound SHA-1 digest', { digestAlgorithm: `${xmlSignature}sha1` }],
  ])('refuses a signed-in attempt with %s', async (_label, patch) => {
    await expect(verifier.verify(input(patch))).resolves.toEqual({ kind: 'refused' });
  });

  it('requires a certificate from the selected connection', async () => {
    const cache = replayCache(requestId);
    const request = input({}, cache);
    await expect(
      verifier.verify({
        ...request,
        binding: { ...request.binding, idpCertificate: otherIdp.certificate },
      }),
    ).resolves.toEqual({ kind: 'refused' });
    expect(cache.consumeAsync).not.toHaveBeenCalled();
    expect(cache.saveIfAbsentAsync).not.toHaveBeenCalled();
  });

  it('refuses a response when the issue time is outside the accepted age or future skew', async () => {
    const now = Date.now();
    for (const issue of [now - 7 * 60_000, now + 2 * 60_000]) {
      await expect(
        verifier.verify(input({ issueTime: new Date(issue).toISOString() })),
      ).resolves.toEqual({ kind: 'refused' });
    }
  });

  it('refuses an expired bearer confirmation', async () => {
    await expect(
      verifier.verify(input({ confirmationExpiry: new Date(Date.now() - 120_000).toISOString() })),
    ).resolves.toEqual({ kind: 'refused' });
  });

  it('refuses a signed response for a request no longer pending', async () => {
    await expect(verifier.verify(input({}, replayCache()))).resolves.toEqual({ kind: 'refused' });
  });

  it('allows only one of two simultaneous copies of a response', async () => {
    const request = input();
    const results = await Promise.all([verifier.verify(request), verifier.verify(request)]);
    expect(results.map(({ kind }) => kind).sort()).toEqual(['refused', 'verified']);
  });

  it('rejects an already accepted assertion ID on a different pending request', async () => {
    const nextRequest = '_atelier-nord-new-request';
    const cache = replayCache(requestId, nextRequest);
    await expect(verifier.verify(input({}, cache))).resolves.toMatchObject({ kind: 'verified' });
    const second = input({ request: nextRequest }, cache);
    await expect(verifier.verify({ ...second, requestId: nextRequest })).resolves.toEqual({
      kind: 'refused',
    });
  });

  it('refuses malformed, oversized and DTD-bearing payloads before cache access', async () => {
    const cache = replayCache(requestId);
    const request = input({}, cache);
    const rejected = [
      '!bad-base64!',
      'A'.repeat(262_148),
      Buffer.from('<!DOCTYPE Response><Response/>').toString('base64'),
    ];
    for (const samlResponse of rejected) {
      await expect(verifier.verify({ ...request, samlResponse })).resolves.toEqual({
        kind: 'refused',
      });
    }
    expect(cache.getAsync).not.toHaveBeenCalled();
  });

  it('reports a replay store outage without exposing its error', async () => {
    const request = input();
    const unavailable = {
      ...request.cache,
      getAsync: vi.fn(() => Promise.reject(new Error('private replay store error'))),
    };
    await expect(verifier.verify({ ...request, cache: unavailable })).resolves.toEqual({
      kind: 'unavailable',
    });
  });
});
