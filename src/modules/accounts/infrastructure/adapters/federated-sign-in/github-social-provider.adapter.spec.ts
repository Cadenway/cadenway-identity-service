import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { GitHubSocialProvider } from './github-social-provider.adapter.js';

const callback = 'https://api.cadenway.example/v1/auth/sign-in/federated/providers/github/callback';
const tokenUrl = 'https://github.com/login/oauth/access_token';
const userUrl = 'https://api.github.com/user';
const fixture = {
  clientId: 'fixture-client',
  clientSecret: 'fixture-client-credential',
  redirectUri: callback,
};
const launch = {
  state: 'A'.repeat(43),
  pkceChallenge: 'B'.repeat(43),
  nonce: 'C'.repeat(43),
};
const exchange = {
  state: launch.state,
  code: 'fixture-authorization-code',
  pkceVerifier: 'D'.repeat(43),
  nonce: launch.nonce,
};
const accessToken = 'fixture-token';
const server = setupServer();

function allowToken() {
  return http.post(tokenUrl, () =>
    HttpResponse.json({ access_token: accessToken, token_type: 'bearer' }),
  );
}

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => {
  server.close();
});

describe('GitHub social provider', () => {
  it('starts the registered OAuth flow with state and an S256 challenge', () => {
    const url = new GitHubSocialProvider(fixture).authorizationUrl(launch);

    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: fixture.clientId,
      redirect_uri: callback,
      scope: 'read:user',
      state: launch.state,
      code_challenge: launch.pkceChallenge,
      code_challenge_method: 'S256',
    });
    expect(url.href).not.toContain(fixture.clientSecret);
  });

  it('rejects a malformed launch challenge and a missing verifier', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const provider = new GitHubSocialProvider(fixture, fetcher);

    expect(() => provider.authorizationUrl({ ...launch, pkceChallenge: 'short' })).toThrow();
    await expect(provider.verify({ ...exchange, pkceVerifier: '' })).rejects.toMatchObject({
      kind: 'refused',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('exchanges the original verifier and proves only the stable ID from the authenticated user', async () => {
    const requests: Request[] = [];
    const fetcher = vi.fn<typeof fetch>((input, init) => globalThis.fetch(input, init));
    let tokenForm: URLSearchParams | undefined;
    server.use(
      http.post(tokenUrl, async ({ request }) => {
        requests.push(request);
        tokenForm = new URLSearchParams(await request.text());
        return HttpResponse.json({ access_token: accessToken, token_type: 'bearer' });
      }),
      http.get(userUrl, ({ request }) => {
        requests.push(request);
        return HttpResponse.json({
          id: 482,
          login: 'renamed-fixture',
          email: 'camille.martin@example.test',
        });
      }),
    );

    await expect(new GitHubSocialProvider(fixture, fetcher).verify(exchange)).resolves.toEqual({
      connection: { provider: 'github', issuer: 'https://github.com' },
      subject: '482',
    });
    expect(tokenForm).toEqual(
      new URLSearchParams({
        client_id: fixture.clientId,
        client_secret: fixture.clientSecret,
        code: exchange.code,
        code_verifier: exchange.pkceVerifier,
        redirect_uri: callback,
      }),
    );
    expect(requests.map(({ method, url }) => ({ method, url }))).toEqual([
      { method: 'POST', url: tokenUrl },
      { method: 'GET', url: userUrl },
    ]);
    expect(fetcher.mock.calls.map(([, init]) => init?.redirect)).toEqual(['error', 'error']);
    expect(requests[0]?.headers.get('authorization')).toBeNull();
    expect(requests[1]?.headers.get('authorization')).toBe(`Bearer ${accessToken}`);
  });

  it.each([200, 400])(
    'returns an opaque refusal for a bad code reported with status %i',
    async (status) => {
      server.use(
        http.post(tokenUrl, () =>
          HttpResponse.json(
            { error: 'bad_verification_code', error_description: exchange.code },
            { status },
          ),
        ),
      );

      const proof = new GitHubSocialProvider(fixture).verify(exchange);
      await expect(proof).rejects.toMatchObject({ kind: 'refused' });
      await expect(proof).rejects.not.toHaveProperty('cause');
      await expect(proof).rejects.not.toThrow(exchange.code);
    },
  );

  it.each(['482', 0, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'requires an exact positive safe numeric GitHub user ID',
    async (id) => {
      server.use(
        allowToken(),
        http.get(userUrl, () => HttpResponse.json({ id })),
      );

      await expect(new GitHubSocialProvider(fixture).verify(exchange)).rejects.toMatchObject({
        kind: 'refused',
      });
    },
  );

  it('never follows a redirect at either credential-bearing request', async () => {
    const redirected = vi.fn(() => HttpResponse.json({ id: 482 }));
    server.use(
      http.all('https://invalid.example/path', redirected),
      http.post(
        tokenUrl,
        () =>
          new HttpResponse(null, {
            status: 307,
            headers: { location: 'https://invalid.example/path' },
          }),
      ),
    );
    const provider = new GitHubSocialProvider(fixture);

    await expect(provider.verify(exchange)).rejects.toMatchObject({ kind: 'unavailable' });
    server.use(
      allowToken(),
      http.get(
        userUrl,
        () =>
          new HttpResponse(null, {
            status: 307,
            headers: { location: 'https://invalid.example/path' },
          }),
      ),
    );
    await expect(provider.verify(exchange)).rejects.toMatchObject({ kind: 'unavailable' });
    expect(redirected).not.toHaveBeenCalled();
  });

  it('rejects an oversized provider body before using its token', async () => {
    server.use(
      http.post(tokenUrl, () =>
        HttpResponse.json({
          access_token: accessToken,
          token_type: 'bearer',
          padding: 'x'.repeat(256 * 1024),
        }),
      ),
    );

    await expect(new GitHubSocialProvider(fixture).verify(exchange)).rejects.toMatchObject({
      kind: 'unavailable',
    });
  });

  it('bounds code exchange time and hides sensitive transport failures', async () => {
    const deadline = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => {
              reject(new Error(`Transport failed for ${exchange.code}`));
            },
            { once: true },
          );
        }),
    );
    const proof = new GitHubSocialProvider(fixture, fetcher).verify(exchange);

    deadline.abort();
    await expect(proof).rejects.toMatchObject({ kind: 'unavailable' });
    await expect(proof).rejects.not.toHaveProperty('cause');
    await expect(proof).rejects.not.toThrow(exchange.code);
    expect(timeout).toHaveBeenCalledWith(5_000);
  });
});
