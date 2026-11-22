import { createSecretKey } from 'node:crypto';

import type { SocialSignInConfig } from '../../../../../../config/social-sign-in-config.js';
import type { SocialProviderCatalog } from '../../../../application/ports/outbound/federation/social-sign-in/social-provider-catalog.port.js';
import type { SocialSignInProvider } from '../../../../application/ports/outbound/federation/social-sign-in/social-sign-in-provider.port.js';
import type { SocialFlowCredentials } from '../../../../application/ports/outbound/security/federation/social-flow-credentials.port.js';
import { GitHubSocialProvider } from '../../../../infrastructure/adapters/federated-sign-in/github-social-provider.adapter.js';
import { OidcSocialProvider } from '../../../../infrastructure/adapters/federated-sign-in/oidc-social-provider.adapter.js';
import { VersionedSocialFlowCredentials } from '../../../../infrastructure/adapters/federated-sign-in/versioned-social-flow-credentials.adapter.js';

type OAuthProvider = Parameters<SocialProviderCatalog['find']>[0];

/** The authorities and browser credentials shared by social sign-in start and callback. */
export interface SocialSignInRuntime {
  // #region Properties
  /** The subset of fixed OAuth authorities enabled by this Identity instance. */
  readonly providers: SocialProviderCatalog;

  /** One issuance version and any still-live state derivation keys. */
  readonly credentials: SocialFlowCredentials;
  // #endregion
}

/** Creates the configured providers locally, using pinned endpoints. */
export function createSocialSignInRuntime(
  config: SocialSignInConfig,
  fetcher: typeof fetch = globalThis.fetch,
): SocialSignInRuntime | null {
  const settings = config.SOCIAL_SIGN_IN_CONFIG;
  if (settings === undefined) return null;

  const providers = new Map<OAuthProvider, SocialSignInProvider>();
  const { google, github, microsoft, gitlab } = settings.providers;
  const redirectUri = (provider: OAuthProvider): string =>
    `${settings.gatewayOrigin}/v1/auth/sign-in/federated/providers/${provider}/callback`;
  if (google !== undefined) {
    providers.set(
      'google',
      new OidcSocialProvider(
        {
          ...google,
          provider: 'google',
          issuer: 'https://accounts.google.com',
          authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
          tokenEndpoint: 'https://oauth2.googleapis.com/token',
          jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
          redirectUri: redirectUri('google'),
        },
        fetcher,
      ),
    );
  }
  if (github !== undefined) {
    providers.set(
      'github',
      new GitHubSocialProvider({ ...github, redirectUri: redirectUri('github') }, fetcher),
    );
  }
  if (microsoft !== undefined) {
    const authority = `https://login.microsoftonline.com/${microsoft.tenantId.toLowerCase()}`;
    providers.set(
      'microsoft',
      new OidcSocialProvider(
        {
          clientId: microsoft.clientId,
          clientSecret: microsoft.clientSecret,
          provider: 'microsoft',
          issuer: `${authority}/v2.0`,
          authorizationEndpoint: `${authority}/oauth2/v2.0/authorize`,
          tokenEndpoint: `${authority}/oauth2/v2.0/token`,
          jwksUri: `${authority}/discovery/v2.0/keys`,
          redirectUri: redirectUri('microsoft'),
        },
        fetcher,
      ),
    );
  }
  if (gitlab !== undefined) {
    providers.set(
      'gitlab',
      new OidcSocialProvider(
        {
          ...gitlab,
          provider: 'gitlab',
          issuer: 'https://gitlab.com',
          authorizationEndpoint: 'https://gitlab.com/oauth/authorize',
          tokenEndpoint: 'https://gitlab.com/oauth/token',
          jwksUri: 'https://gitlab.com/oauth/discovery/keys',
          redirectUri: redirectUri('gitlab'),
        },
        fetcher,
      ),
    );
  }
  const keys = new Map(
    Object.entries(settings.stateKeys).map(([version, encodedKey]) => [
      version,
      createSecretKey(Buffer.from(encodedKey, 'base64url')),
    ]),
  );
  return {
    providers: { find: (provider) => providers.get(provider) ?? null },
    credentials: new VersionedSocialFlowCredentials(settings.activeKeyVersion, keys),
  };
}
