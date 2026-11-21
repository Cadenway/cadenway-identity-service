import { generateKeyPairSync, sign } from 'node:crypto';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { SocialSignInProviderError } from '../../../domain/errors/federated-sign-in/social-sign-in-provider.error.js';
import { OidcSocialProvider } from './oidc-social-provider.adapter.js';

const providers = {
  google: {
    issuer: 'https://accounts.google.com',
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
  },
  microsoft: {
    issuer: 'https://login.microsoftonline.com/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/v2.0',
    authorizationEndpoint:
      'https://login.microsoftonline.com/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/oauth2/v2.0/authorize',
    tokenEndpoint:
      'https://login.microsoftonline.com/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/oauth2/v2.0/token',
    jwksUri:
      'https://login.microsoftonline.com/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/discovery/v2.0/keys',
  },
  gitlab: {
    issuer: 'https://gitlab.com',
    authorizationEndpoint: 'https://gitlab.com/oauth/authorize',
    tokenEndpoint: 'https://gitlab.com/oauth/token',
    jwksUri: 'https://gitlab.com/oauth/discovery/keys',
  },
} as const;

const credentials = { clientId: 'fixture-client', clientSecret: 'synthetic-client-material' };
const start = {
  state: 's'.repeat(43),
  nonce: 'n'.repeat(43),
  pkceChallenge: 'c'.repeat(43),
};
const callback = { ...start, code: 'synthetic-opaque-code', pkceVerifier: 'v'.repeat(43) };
const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const otherKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
const key = { ...keyPair.publicKey.export({ format: 'jwk' }), kid: 'fixture', alg: 'RS256' };
const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

function redirectUri(provider: keyof typeof providers): string {
  return `https://api.cadenway.test/v1/auth/sign-in/federated/providers/${provider}/callback`;
}

function identityProvider(provider: keyof typeof providers): OidcSocialProvider {
  return new OidcSocialProvider({
    ...providers[provider],
    ...credentials,
    provider,
    redirectUri: redirectUri(provider),
  });
}

function makeIdToken(
  issuer: string,
  overrides: Record<string, unknown> = {},
  privateKey = keyPair.privateKey,
): string {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: issuer,
    sub: 'stable-subject',
    aud: credentials.clientId,
    exp: now + 300,
    iat: now,
    nonce: start.nonce,
    email: 'camille@atelier.example',
    ...overrides,
  };
  const encoded = [
    Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fixture' })).toString('base64url'),
    Buffer.from(JSON.stringify(claims)).toString('base64url'),
  ].join('.');
  const signature = sign('RSA-SHA256', Buffer.from(encoded), privateKey).toString('base64url');
  return `${encoded}.${signature}`;
}

function respondWithTokens(idToken?: string) {
  return HttpResponse.json({
    token_type: 'Bearer',
    access_token: 'synthetic-access-token',
    ...(idToken === undefined ? {} : { id_token: idToken }),
  });
}

function expectOpaqueFailure(failure: unknown, kind: SocialSignInProviderError['kind']): void {
  expect(failure).toBeInstanceOf(SocialSignInProviderError);
  expect(failure).toHaveProperty('kind', kind);
  expect(failure).toHaveProperty(
    'message',
    kind === 'refused' ? 'Federated sign-in cannot continue.' : 'Federated authority unavailable.',
  );
  expect(failure).not.toHaveProperty('cause');
}

describe.each(['google', 'microsoft', 'gitlab'] as const)('%s social sign-in', (provider) => {
  const configured = providers[provider];

  it('builds a configured authorization code redirect and verifies the bound signed subject', async () => {
    const exchanges: URLSearchParams[] = [];
    const evidence: string[] = [];
    server.use(
      http.post(configured.tokenEndpoint, async ({ request }) => {
        evidence.push('token');
        exchanges.push(new URLSearchParams(await request.text()));
        return respondWithTokens(makeIdToken(configured.issuer));
      }),
      http.get(configured.jwksUri, () => {
        evidence.push('keys');
        return HttpResponse.json({ keys: [key] });
      }),
    );
    const adapter = identityProvider(provider);
    const redirect = adapter.authorizationUrl(start);
    expect(redirect.href.split('?')[0]).toBe(configured.authorizationEndpoint);
    expect(Object.fromEntries(redirect.searchParams)).toEqual({
      client_id: credentials.clientId,
      response_type: 'code',
      redirect_uri: redirectUri(provider),
      scope: 'openid',
      code_challenge: start.pkceChallenge,
      code_challenge_method: 'S256',
      state: start.state,
      nonce: start.nonce,
    });
    await expect(adapter.verify(callback)).resolves.toEqual({
      connection: { provider, issuer: configured.issuer },
      subject: 'stable-subject',
    });
    expect(evidence).toEqual(['token', 'keys']);
    expect(Object.fromEntries(exchanges[0] ?? [])).toEqual({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri(provider),
      code: callback.code,
      code_verifier: callback.pkceVerifier,
    });
  });
});

describe('OIDC verification refusals', () => {
  const configured = providers.google;

  it.each([
    { name: 'issuer', override: { iss: 'https://other.example' } },
    { name: 'audience', override: { aud: 'another-client' } },
    { name: 'nonce', override: { nonce: 'different-nonce' } },
    { name: 'expiration', override: { exp: 1 } },
    { name: 'subject', override: { sub: ' ' } },
  ])('refuses an invalid $name without exposing provider claims', async ({ override }) => {
    server.use(
      http.post(configured.tokenEndpoint, () =>
        respondWithTokens(makeIdToken(configured.issuer, override)),
      ),
      http.get(configured.jwksUri, () => HttpResponse.json({ keys: [key] })),
    );
    expectOpaqueFailure(
      await identityProvider('google')
        .verify(callback)
        .catch((failure: unknown) => failure),
      'refused',
    );
  });

  it('requires a valid signature even when all claims match', async () => {
    server.use(
      http.post(configured.tokenEndpoint, () =>
        respondWithTokens(makeIdToken(configured.issuer, {}, otherKey)),
      ),
      http.get(configured.jwksUri, () => HttpResponse.json({ keys: [key] })),
    );
    expectOpaqueFailure(
      await identityProvider('google')
        .verify(callback)
        .catch((failure: unknown) => failure),
      'refused',
    );
  });

  it('requires the identity token and refuses exchange without a verifier', async () => {
    let exchanges = 0;
    server.use(
      http.post(configured.tokenEndpoint, () => {
        exchanges += 1;
        return respondWithTokens();
      }),
    );
    const adapter = identityProvider('google');
    await expect(adapter.verify({ ...callback, pkceVerifier: '' })).rejects.toMatchObject({
      kind: 'refused',
    });
    await expect(adapter.verify(callback)).rejects.toMatchObject({ kind: 'refused' });
    expect(exchanges).toBe(1);
  });
});

describe('OIDC authority boundaries', () => {
  it('rejects an authority redirect before forwarding a credential', async () => {
    let forwarded = false;
    const otherEndpoint = 'https://other.example/token';
    server.use(
      http.post(
        providers.google.tokenEndpoint,
        () => new HttpResponse(null, { status: 307, headers: { Location: otherEndpoint } }),
      ),
      http.post(otherEndpoint, () => {
        forwarded = true;
        return respondWithTokens();
      }),
    );
    expectOpaqueFailure(
      await identityProvider('google')
        .verify(callback)
        .catch((failure: unknown) => failure),
      'unavailable',
    );
    expect(forwarded).toBe(false);
  });

  it('treats temporary provider failure as unavailable without returning its text', async () => {
    server.use(
      http.post(providers.google.tokenEndpoint, () =>
        HttpResponse.json({ detail: 'provider-specific detail' }, { status: 503 }),
      ),
    );
    expectOpaqueFailure(
      await identityProvider('google')
        .verify(callback)
        .catch((failure: unknown) => failure),
      'unavailable',
    );
  });

  it('rejects an oversized provider response before parsing it', async () => {
    server.use(
      http.post(providers.google.tokenEndpoint, () => HttpResponse.text('x'.repeat(262_145))),
    );
    expectOpaqueFailure(
      await identityProvider('google')
        .verify(callback)
        .catch((failure: unknown) => failure),
      'unavailable',
    );
  });

  it('rejects a credential-bearing or insecure token destination during configuration', () => {
    const settings = {
      ...providers.google,
      ...credentials,
      provider: 'google' as const,
      redirectUri: redirectUri('google'),
    };
    expect(
      () => new OidcSocialProvider({ ...settings, tokenEndpoint: 'http://provider.example/token' }),
    ).toThrow('Invalid configured OIDC authority endpoint.');
    expect(
      () =>
        new OidcSocialProvider({
          ...settings,
          tokenEndpoint: 'https://user@provider.example/token',
        }),
    ).toThrow('Invalid configured OIDC authority endpoint.');
  });
});
