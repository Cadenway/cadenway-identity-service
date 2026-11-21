import {
  authorizationCodeGrant,
  buildAuthorizationUrl,
  ClientError,
  Configuration,
  customFetch,
  enableNonRepudiationChecks,
  ResponseBodyError,
} from 'openid-client';

import type { SocialSignInProvider } from '../../../application/ports/outbound/federation/social-sign-in/social-sign-in-provider.port.js';
import { SocialSignInProviderError } from '../../../domain/errors/federated-sign-in/social-sign-in-provider.error.js';
import type { VerifiedFederatedIdentity } from '../../../domain/value-objects/federated-sign-in/verified-federated-identity.value-object.js';
import { readSocialProviderBody } from './read-social-provider-body.js';
import { parseSocialRedirectUri } from './social-redirect-uri.js';

interface OidcSocialClientSettings {
  // #region Properties
  /** Allows only the three providers that return an ID token for social sign-in. */
  readonly provider: 'google' | 'microsoft' | 'gitlab';

  /** Concrete, registered issuer used for both claim verification and account lookup. */
  readonly issuer: string;
  readonly authorizationEndpoint: string;
  readonly tokenEndpoint: string;
  readonly jwksUri: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  // #endregion
}

const statePattern = /^[A-Za-z0-9_-]{32,80}$/u;
const noncePattern = /^[A-Za-z0-9_-]{32,128}$/u;
const challengePattern = /^[A-Za-z0-9_-]{43}$/u;
const verifierPattern = /^[A-Za-z0-9._~-]{43,128}$/u;
const subjectPattern = /^[!-~]{1,255}$/u;
const unavailableErrors = new Set([
  'invalid_client',
  'unauthorized_client',
  'server_error',
  'temporarily_unavailable',
]);

function configuredHttpsEndpoint(value: string): string {
  const url = URL.parse(value);
  if (
    url?.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    value.includes('#')
  ) {
    throw new TypeError('Invalid configured OIDC authority endpoint.');
  }
  return url.href;
}

function sanitizedFailure(error: unknown): SocialSignInProviderError {
  const transport = error instanceof ClientError ? error.cause : error;
  if (transport instanceof SocialSignInProviderError) return transport;
  const unavailable = error instanceof ResponseBodyError && unavailableErrors.has(error.error);
  return new SocialSignInProviderError(unavailable ? 'unavailable' : 'refused');
}

/**
 * Exchanges Google, Microsoft and GitLab authorization codes using a fixed configured client.
 * Only the verified provider subject leaves the adapter.
 */
export class OidcSocialProvider implements SocialSignInProvider {
  // #region Properties
  /** Authority selected at the start of the flow and retained through verification. */
  public readonly connection: SocialSignInProvider['connection'];

  /** OAuth client with pinned authority endpoints and mandatory ID token signatures. */
  private readonly configuration: Configuration;

  /** Exact registered callback used for both authorization and exchange. */
  private readonly callback: string;
  // #endregion

  // #region Constructor
  /** Accepts operator-supplied settings and performs no network I/O. */
  public constructor(settings: OidcSocialClientSettings, fetcher: typeof fetch = globalThis.fetch) {
    const { provider, issuer, clientId, clientSecret } = settings;
    configuredHttpsEndpoint(issuer);
    if (issuer.includes('?') || clientId.trim() === '' || clientSecret.trim() === '') {
      throw new TypeError('Invalid configured OIDC client.');
    }
    this.connection = Object.freeze({ provider, issuer });
    this.callback = parseSocialRedirectUri(settings.redirectUri).href;
    const tokenEndpoint = configuredHttpsEndpoint(settings.tokenEndpoint);
    const jwksUri = configuredHttpsEndpoint(settings.jwksUri);
    this.configuration = new Configuration(
      {
        issuer,
        authorization_endpoint: configuredHttpsEndpoint(settings.authorizationEndpoint),
        token_endpoint: tokenEndpoint,
        jwks_uri: jwksUri,
      },
      clientId,
      { client_secret: clientSecret, id_token_signed_response_alg: 'RS256' },
    );
    this.configuration.timeout = 5;
    this.configuration[customFetch] = async (url, options) => {
      if (url !== tokenEndpoint && url !== jwksUri) {
        throw new SocialSignInProviderError('unavailable');
      }
      try {
        const body =
          options.body instanceof Uint8Array ? new Uint8Array(options.body) : options.body;
        const response = await fetcher(url, {
          ...options,
          body,
          cache: 'no-store',
          redirect: 'error',
        });
        if (
          (response.status >= 300 && response.status < 400) ||
          response.status >= 500 ||
          response.status === 429
        ) {
          await response.body?.cancel();
          throw new SocialSignInProviderError('unavailable');
        }
        const bytes = await readSocialProviderBody(response);
        return new Response(bytes.byteLength === 0 ? null : bytes, {
          status: response.status,
          headers: response.headers,
        });
      } catch {
        throw new SocialSignInProviderError('unavailable');
      }
    };
    // Code-flow ID tokens arrive over TLS, but this contract also requires their JWS signature.
    enableNonRepudiationChecks(this.configuration);
  }
  // #endregion

  // #region Methods
  /** Returns only the configured authorization redirect and per-flow browser parameters. */
  public authorizationUrl(input: Parameters<SocialSignInProvider['authorizationUrl']>[0]): URL {
    if (
      !statePattern.test(input.state) ||
      !noncePattern.test(input.nonce) ||
      !challengePattern.test(input.pkceChallenge)
    ) {
      throw new SocialSignInProviderError('refused');
    }
    return buildAuthorizationUrl(this.configuration, {
      redirect_uri: this.callback,
      response_type: 'code',
      scope: 'openid',
      state: input.state,
      nonce: input.nonce,
      code_challenge: input.pkceChallenge,
      code_challenge_method: 'S256',
    });
  }

  /** Verifies the code and mandatory ID token for a flow already claimed by Identity. */
  public async verify(
    input: Parameters<SocialSignInProvider['verify']>[0],
  ): Promise<VerifiedFederatedIdentity> {
    if (
      !statePattern.test(input.state) ||
      !noncePattern.test(input.nonce) ||
      !verifierPattern.test(input.pkceVerifier) ||
      input.code.length === 0 ||
      input.code.length > 4096
    ) {
      throw new SocialSignInProviderError('refused');
    }
    const callback = new URL(this.callback);
    callback.searchParams.set('state', input.state);
    callback.searchParams.set('code', input.code);
    try {
      const tokens = await authorizationCodeGrant(this.configuration, callback, {
        expectedState: input.state,
        expectedNonce: input.nonce,
        pkceCodeVerifier: input.pkceVerifier,
      });
      const subject = tokens.claims()?.sub;
      if (subject === undefined || !subjectPattern.test(subject)) {
        throw new SocialSignInProviderError('refused');
      }
      return { connection: this.connection, subject };
    } catch (error) {
      throw sanitizedFailure(error);
    }
  }
  // #endregion
}
