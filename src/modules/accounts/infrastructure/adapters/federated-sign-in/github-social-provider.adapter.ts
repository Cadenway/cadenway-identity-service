import { z } from 'zod';

import type { SocialSignInProvider } from '../../../application/ports/outbound/federation/social-sign-in/social-sign-in-provider.port.js';
import { SocialSignInProviderError } from '../../../domain/errors/federated-sign-in/social-sign-in-provider.error.js';
import type { VerifiedFederatedIdentity } from '../../../domain/value-objects/federated-sign-in/verified-federated-identity.value-object.js';
import { readSocialProviderBody } from './read-social-provider-body.js';
import { parseSocialRedirectUri } from './social-redirect-uri.js';

const providerTimeoutMs = 5_000;
const statePattern = /^[A-Za-z0-9_-]{32,80}$/u;
const challengePattern = /^[A-Za-z0-9_-]{43}$/u;
const verifierPattern = /^[A-Za-z0-9._~-]{43,128}$/u;
const tokenEndpoint = 'https://github.com/login/oauth/access_token';
const userEndpoint = 'https://api.github.com/user';

const tokenResponse = z.object({
  access_token: z
    .string()
    .max(2048)
    .regex(/^[A-Za-z0-9._~+/-]+=*$/u),
  token_type: z.string().regex(/^bearer$/iu),
  error: z.never().optional(),
});
const tokenRefusal = z.object({
  error: z.enum(['bad_verification_code', 'unverified_user_email', 'access_denied']),
});
const userResponse = z.object({ id: z.int().positive() });

/** Settings for the deployment's registered GitHub OAuth application. */
interface GitHubSocialProviderConfig {
  // #region Properties
  /** The public identifier of the app. */
  readonly clientId: string;

  /** The server-side credential used for code exchange. */
  readonly clientSecret: string;

  /** The exact callback URI registered for the app. */
  readonly redirectUri: string;
  // #endregion
}

async function readGitHubJson(response: Response): Promise<unknown> {
  const body = await readSocialProviderBody(response);
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)) as unknown;
}

/** Exchanges the claimed GitHub OAuth code and proves an identity by its stable user ID. */
export class GitHubSocialProvider implements SocialSignInProvider {
  // #region Properties
  /** GitHub does not issue an ID token for this OAuth application. */
  public readonly connection = Object.freeze({ provider: 'github', issuer: 'https://github.com' });

  /** Client identifier included in the browser authorization request. */
  readonly #clientId: string;

  /** Server-only credential for the GitHub token endpoint. */
  readonly #clientSecret: string;

  /** Original URI string, shared unchanged by authorization and code exchange. */
  readonly #redirectUri: string;

  /** Outbound transport, injectable for local tests. */
  readonly #fetch: typeof fetch;
  // #endregion

  // #region Constructor
  /** Uses a registered callback URI supplied by trusted deployment configuration. */
  public constructor(config: GitHubSocialProviderConfig, fetcher: typeof fetch = globalThis.fetch) {
    parseSocialRedirectUri(config.redirectUri);
    if (config.clientId.trim() === '' || config.clientSecret.trim() === '') {
      throw new TypeError('Missing GitHub OAuth application credentials.');
    }
    this.#clientId = config.clientId;
    this.#clientSecret = config.clientSecret;
    this.#redirectUri = config.redirectUri;
    this.#fetch = fetcher;
  }
  // #endregion

  // #region Methods
  /** Binds the browser authorization to the server-generated state and S256 challenge. */
  public authorizationUrl(input: Parameters<SocialSignInProvider['authorizationUrl']>[0]): URL {
    if (!statePattern.test(input.state) || !challengePattern.test(input.pkceChallenge)) {
      throw new SocialSignInProviderError('refused');
    }
    const url = new URL('https://github.com/login/oauth/authorize');
    url.search = new URLSearchParams({
      client_id: this.#clientId,
      redirect_uri: this.#redirectUri,
      scope: 'read:user',
      state: input.state,
      code_challenge: input.pkceChallenge,
      code_challenge_method: 'S256',
    }).toString();
    return url;
  }

  /** Resolves the GitHub account for a code whose browser flow the caller already claimed. */
  public async verify(
    input: Parameters<SocialSignInProvider['verify']>[0],
  ): Promise<VerifiedFederatedIdentity> {
    if (
      !statePattern.test(input.state) ||
      !verifierPattern.test(input.pkceVerifier) ||
      input.code.length === 0 ||
      input.code.length > 4096
    ) {
      throw new SocialSignInProviderError('refused');
    }
    const signal = AbortSignal.timeout(providerTimeoutMs);
    try {
      const token = await this.requestJson(tokenEndpoint, {
        method: 'POST',
        headers: { accept: 'application/json' },
        body: new URLSearchParams({
          client_id: this.#clientId,
          client_secret: this.#clientSecret,
          code: input.code,
          code_verifier: input.pkceVerifier,
          redirect_uri: this.#redirectUri,
        }),
        signal,
      });
      if (tokenRefusal.safeParse(token).success) throw new SocialSignInProviderError('refused');
      const access = tokenResponse.safeParse(token);
      if (!access.success) throw new SocialSignInProviderError('unavailable');

      const user = await this.requestJson(userEndpoint, {
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${access.data.access_token}`,
          'user-agent': 'cadenway-identity-service',
          'x-github-api-version': '2022-11-28',
        },
        signal,
      });
      const profile = userResponse.safeParse(user);
      if (!profile.success) throw new SocialSignInProviderError('refused');
      return { connection: this.connection, subject: String(profile.data.id) };
    } catch (error) {
      if (error instanceof SocialSignInProviderError) throw error;
      throw new SocialSignInProviderError('unavailable');
    }
  }

  /** Reads a bounded JSON response while preventing credentials from following redirects. */
  private async requestJson(url: string, init: RequestInit): Promise<unknown> {
    const response = await this.#fetch(url, { ...init, redirect: 'error', cache: 'no-store' });
    if (!response.ok) {
      if (
        url === tokenEndpoint &&
        response.status === 400 &&
        tokenRefusal.safeParse(await readGitHubJson(response)).success
      ) {
        throw new SocialSignInProviderError('refused');
      }
      await response.body?.cancel().catch(() => undefined);
      throw new SocialSignInProviderError(
        url === userEndpoint && response.status === 401 ? 'refused' : 'unavailable',
      );
    }
    return readGitHubJson(response);
  }
  // #endregion
}
