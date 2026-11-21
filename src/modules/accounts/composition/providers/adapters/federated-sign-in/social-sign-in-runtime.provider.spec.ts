import { describe, expect, it, vi } from 'vitest';

import { socialSignInConfigShape } from '../../../../../../config/social-sign-in-config.js';
import { createSocialSignInRuntime } from './social-sign-in-runtime.provider.js';

const fakeCredentials = { clientId: 'local-client', clientSecret: 'local-credential' };
const gatewayOrigin = 'http://api.cadenway.localhost:8080';
const tenantId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const stateKeys = {
  k1: Buffer.alloc(32, 1).toString('base64url'),
  k2: Buffer.alloc(32, 2).toString('base64url'),
};
const allProviders = {
  google: fakeCredentials,
  github: fakeCredentials,
  microsoft: { ...fakeCredentials, tenantId },
  gitlab: fakeCredentials,
};

function config(overrides: object = {}): string {
  return JSON.stringify({
    gatewayOrigin,
    activeKeyVersion: 'k2',
    stateKeys,
    providers: allProviders,
    ...overrides,
  });
}

// Fails on any accidental outbound request. Constructors and authorization URLs are local.
const unexpectedFetch = vi.fn<typeof fetch>(() => {
  throw new Error('Unexpected outbound connection in the OAuth runtime test.');
});

describe('social sign-in runtime', () => {
  it('disables social sign-in when configuration is absent or blank', () => {
    expect(createSocialSignInRuntime({})).toBeNull();
    expect(socialSignInConfigShape.SOCIAL_SIGN_IN_CONFIG.parse(undefined)).toBeUndefined();
    expect(socialSignInConfigShape.SOCIAL_SIGN_IN_CONFIG.parse('  ')).toBeUndefined();
    expect(unexpectedFetch).not.toHaveBeenCalled();
  });

  it.each([
    {
      provider: 'google',
      issuer: 'https://accounts.google.com',
      endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    },
    {
      provider: 'github',
      issuer: 'https://github.com',
      endpoint: 'https://github.com/login/oauth/authorize',
    },
    {
      provider: 'microsoft',
      issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      endpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    },
    {
      provider: 'gitlab',
      issuer: 'https://gitlab.com',
      endpoint: 'https://gitlab.com/oauth/authorize',
    },
  ] as const)(
    'uses the fixed $provider authority and the registered Gateway callback',
    ({ provider, issuer, endpoint }) => {
      const runtime = createSocialSignInRuntime(
        { SOCIAL_SIGN_IN_CONFIG: socialSignInConfigShape.SOCIAL_SIGN_IN_CONFIG.parse(config()) },
        unexpectedFetch,
      );
      if (runtime === null) throw new Error('Expected a configured social runtime.');
      const adapter = runtime.providers.find(provider);
      if (adapter === null) throw new Error('Expected a configured social provider.');
      const { state } = runtime.credentials.issue();
      const { nonce, pkceChallenge } = runtime.credentials.providerSecrets(state);
      const authorizationUrl = adapter.authorizationUrl({ state, nonce, pkceChallenge });

      expect(adapter.connection).toEqual({ provider, issuer });
      expect(`${authorizationUrl.origin}${authorizationUrl.pathname}`).toBe(endpoint);
      expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(
        `${gatewayOrigin}/v1/auth/sign-in/federated/providers/${provider}/callback`,
      );
      expect(authorizationUrl.searchParams.get('client_id')).toBe(fakeCredentials.clientId);
      expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256');
      expect(authorizationUrl.searchParams.get('state')).toBe(state);
      expect(authorizationUrl.searchParams.has('client_secret')).toBe(false);
      expect(unexpectedFetch).not.toHaveBeenCalled();
    },
  );

  it('enables only configured providers and retains old state derivations during rotation', () => {
    const create = (activeKeyVersion: string) =>
      createSocialSignInRuntime(
        {
          SOCIAL_SIGN_IN_CONFIG: socialSignInConfigShape.SOCIAL_SIGN_IN_CONFIG.parse(
            config({ activeKeyVersion, providers: { github: fakeCredentials } }),
          ),
        },
        unexpectedFetch,
      );
    const previous = create('k1');
    const current = create('k2');
    if (previous === null || current === null) throw new Error('Expected both key versions.');
    const { state } = previous.credentials.issue();

    expect(current.providers.find('github')).not.toBeNull();
    expect(current.providers.find('google')).toBeNull();
    expect(current.providers.find('microsoft')).toBeNull();
    expect(current.providers.find('gitlab')).toBeNull();
    expect(current.credentials.issue().state).toMatch(/^k2_/u);
    expect(current.credentials.providerSecrets(state)).toEqual(
      previous.credentials.providerSecrets(state),
    );
  });

  it.each([
    { gatewayOrigin: 'http://gateway.example.test' },
    { gatewayOrigin: 'https://gateway.example.test/a-path' },
    { gatewayOrigin: 'https://gateway.example.test/?query' },
    { gatewayOrigin: 'https://user@gateway.example.test' },
    { activeKeyVersion: 'k3' },
    { stateKeys: { k2: Buffer.alloc(31).toString('base64url') } },
    { providers: {} },
    { providers: { microsoft: { ...fakeCredentials, tenantId: 'common' } } },
    { providers: { other: fakeCredentials } },
    { providers: { google: { ...fakeCredentials, tokenEndpoint: 'https://other.example' } } },
  ])('refuses invalid settings with a sanitized issue', (overrides) => {
    const result = socialSignInConfigShape.SOCIAL_SIGN_IN_CONFIG.safeParse(config(overrides));
    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected validation to fail.');
    expect(result.error.issues).toEqual([
      { code: 'custom', message: 'Expected a valid social sign-in configuration.', path: [] },
    ]);
  });
});
