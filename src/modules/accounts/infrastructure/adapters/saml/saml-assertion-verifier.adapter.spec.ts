import { createSecretKey, randomBytes } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  assertionId,
  callbackUrl,
  connection,
  createTestIdp,
  requestId,
  serviceProvider,
  signedPost,
  subject,
  xmlSignature,
} from '../../../../../../tests/support/federated-saml.fixture.js';
import type {
  PostOptions,
  TestIdp,
} from '../../../../../../tests/support/federated-saml.fixture.js';

import type { SocialFlowStore } from '../../../application/ports/outbound/transactions/federation/social-flow-store.port.js';
import type { SocialFlowUnitOfWork } from '../../../application/ports/outbound/transactions/federation/social-flow-unit-of-work.port.js';
import { CompleteSamlSignIn } from '../../../application/use-cases/commands/federated-sign-in/complete-saml-sign-in/complete-saml-sign-in.use-case.js';
import { StartSamlSignIn } from '../../../application/use-cases/commands/federated-sign-in/start-saml-sign-in/start-saml-sign-in.use-case.js';
import { VersionedSocialFlowCredentials } from '../federated-sign-in/versioned-social-flow-credentials.adapter.js';
import { ConfiguredSamlSignInCatalog } from './configured-saml-sign-in-catalog.adapter.js';
import type { SamlAssertionVerificationInput } from './saml-assertion-verification.input.js';
import { SamlAssertionVerifier } from './saml-assertion-verifier.adapter.js';

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

describe('configured SAML sign-in', () => {
  let idp: TestIdp;

  beforeAll(() => {
    idp = createTestIdp();
  });

  function setup() {
    const samlConnection = {
      ...connection,
      organizationId: '01938f6e-6d1a-7c3e-9a51-2f0c4b8d7e10',
    };
    const config = {
      ...samlConnection,
      verifiedDomains: ['atelier.example.test'],
      entryPoint: 'https://idp.example.test/atelier-nord/sso',
      idpCertificate: idp.certificate,
      serviceProviderEntityId: serviceProvider,
      assertionConsumerUrl: callbackUrl,
    };
    const assertionClaims = new Set<string>();
    const claim = vi.fn((_: unknown, key: string) => {
      if (assertionClaims.has(key)) return Promise.resolve(false);
      assertionClaims.add(key);
      return Promise.resolve(true);
    });
    const catalog = new ConfiguredSamlSignInCatalog([config], { claim });
    const credentials = new VersionedSocialFlowCredentials(
      'k1',
      new Map([['k1', createSecretKey(randomBytes(32))]]),
    );
    const clock = { now: () => new Date() };
    const records = new Map<string, Awaited<ReturnType<SocialFlowStore['findByStateHash']>>>();
    let flowCount = 0;
    const findLink = vi.fn<SocialFlowStore['findLink']>((identity) =>
      Promise.resolve({ identity, status: 'active', id: 'linked-account', userId: 'linked-user' }),
    );
    const isEligible = vi.fn<SocialFlowStore['isEligible']>(() => Promise.resolve(true));
    const store: SocialFlowStore = {
      nextFlowId: () => Promise.resolve(`flow-${String(++flowCount)}`),
      insert: (flow) => {
        records.set(flow.snapshot.stateHash, { flow, version: 1 });
        return Promise.resolve();
      },
      findByStateHash: (digest) => Promise.resolve(records.get(digest) ?? null),
      save: (flow, version) => {
        const key = flow.snapshot.stateHash;
        if (records.get(key)?.version !== version) return Promise.resolve(false);
        records.set(key, { flow, version: version + 1 });
        return Promise.resolve(true);
      },
      findLink,
      isEligible,
    };
    const work: SocialFlowUnitOfWork = { run: (stage) => stage(store) };
    return {
      samlConnection,
      config,
      claim,
      credentials,
      store,
      findLink,
      isEligible,
      start: new StartSamlSignIn(catalog, credentials, clock, work),
      complete: new CompleteSamlSignIn(catalog, credentials, clock, work),
    };
  }

  it('requires the original browser and signs in only the linked subject of the verified domain', async () => {
    const { start, complete, store, claim, credentials, samlConnection, findLink, isEligible } =
      setup();
    await expect(start.execute({ email: 'person@unverified.example.test' })).resolves.toEqual({
      kind: 'refused',
    });
    const started = await start.execute({
      email: 'person@ATELIER.EXAMPLE.TEST',
      rememberMe: true,
    });
    if (started.kind !== 'started') throw new Error('The SAML authority did not start.');
    const url = new URL(started.authorizationUrl);
    const request = url.searchParams.get('SAMLRequest');
    const relayState = url.searchParams.get('RelayState');
    if (request === null || relayState === null) throw new Error('Expected a SAML AuthnRequest.');
    expect(url.origin).toBe('https://idp.example.test');
    expect(inflateRawSync(Buffer.from(request, 'base64')).toString('utf8')).toContain(
      'ID="_flow-1"',
    );
    const callback = {
      samlResponse: signedPost(idp, { request: '_flow-1' }),
      relayState,
      browserBinding: started.browserBinding,
    };

    await expect(
      complete.execute({ ...callback, browserBinding: 'other-browser' }),
    ).resolves.toEqual({ kind: 'refused' });
    expect(claim).not.toHaveBeenCalled();
    const issued = await complete.execute(callback);
    if (issued.kind !== 'issued') throw new Error('The linked account did not receive a receipt.');
    expect(findLink).toHaveBeenCalledWith({ ...samlConnection, subject });
    expect(isEligible).toHaveBeenCalledWith('linked-user', samlConnection);
    expect(claim).toHaveBeenCalledWith(
      samlConnection,
      expect.stringContaining(assertionId),
      expect.any(Date),
    );
    const record = await store.findByStateHash(credentials.digest(relayState));
    expect(record?.flow.snapshot).toMatchObject({
      persistent: true,
      connection: samlConnection,
      phase: {
        kind: 'complete',
        continuation: {
          userId: 'linked-user',
          receiptHash: credentials.digest(issued.receipt),
        },
      },
    });
    await expect(complete.execute(callback)).resolves.toEqual({ kind: 'refused' });
    expect(claim).toHaveBeenCalledTimes(1);
  });

  it('rejects SAML configuration that assigns the same domain to another organization', () => {
    const { config, claim } = setup();
    expect(
      () =>
        new ConfiguredSamlSignInCatalog(
          [config, { ...config, organizationId: '01938f6e-6d1a-7c3e-9a51-2f0c4b8d7e11' }],
          { claim },
        ),
    ).toThrow('Ambiguous verified SAML domain.');
  });
});
