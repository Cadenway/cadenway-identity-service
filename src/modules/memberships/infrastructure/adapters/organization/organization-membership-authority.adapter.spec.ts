import type { InternalTokenSigner } from '@cadenway/nest-common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OrganizationMembershipAuthority } from './organization-membership-authority.adapter.js';

const origin = 'http://organization-service:3011';
const organizationId = '01956a7c-273b-79cf-a010-949174963fda';
const userId = '01956a7c-273b-79cf-a011-949174963fda';
const memberId = '01956a7c-273b-79cf-a012-949174963fda';
const active = { memberId, role: 'member', version: 2 };
const notFound = {
  type: 'https://api.cadenway.example/problems/organization.not-found',
  title: 'Not Found',
  status: 404,
  code: 'organization.not-found',
};
const unavailable = { problem: { status: 503, code: 'organization.unavailable' } };

function setup(fetcher = vi.fn<typeof fetch>()) {
  const sign = vi.fn<InternalTokenSigner['sign']>().mockResolvedValue('fixture-signature');
  return {
    authority: new OrganizationMembershipAuthority(origin, { sign }, fetcher),
    fetcher,
    sign,
  };
}

function problem(body: unknown): Response {
  return Response.json(body, {
    status: 404,
    headers: { 'content-type': 'application/problem+json; charset=utf-8' },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OrganizationMembershipAuthority', () => {
  it('signs only the verified actor and tenant and validates the current membership', async () => {
    const { authority, fetcher, sign } = setup();
    fetcher.mockResolvedValue(Response.json(active));

    await expect(authority.find(organizationId, userId)).resolves.toStrictEqual({
      memberId,
      role: 'member',
    });
    expect(sign).toHaveBeenCalledExactlyOnceWith('organization-service', {
      actor: { type: 'user', id: userId },
      organizationId,
      scopes: [],
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [input, init] = fetcher.mock.calls[0] ?? [];
    expect(input).toBe(`${origin}/internal/v1/search-membership`);
    expect(init).toMatchObject({
      method: 'GET',
      headers: {
        accept: 'application/json, application/problem+json',
        authorization: 'Bearer fixture-signature',
      },
      redirect: 'error',
      cache: 'no-store',
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('returns no membership for the authority’s explicit not-found problem', async () => {
    const { authority, fetcher } = setup();
    fetcher.mockResolvedValue(problem(notFound));

    await expect(authority.find(organizationId, userId)).resolves.toBeNull();
  });

  it.each([
    ['a missing route', () => new Response(null, { status: 404 })],
    ['an unrelated problem', () => problem({ ...notFound, code: 'route.not-found' })],
    ['a mismatched problem status', () => problem({ ...notFound, status: 400 })],
    ['an incomplete problem', () => problem({ code: 'organization.not-found', status: 404 })],
    ['a forged absence in JSON', () => Response.json(notFound, { status: 404 })],
    ['a redirect', () => Response.redirect('https://example.test', 302)],
    ['an unavailable service', () => new Response(null, { status: 503 })],
    ['an unauthorized caller', () => new Response(null, { status: 401 })],
    ['an unexpected success status', () => Response.json(active, { status: 201 })],
    ['an unexpected media type', () => new Response(JSON.stringify(active))],
    ['a malformed role', () => Response.json({ ...active, role: 'unknown-role' })],
    ['a missing version', () => Response.json({ memberId, role: 'member' })],
    [
      'a non-JSON success body',
      () => new Response('{bad JSON', { headers: { 'content-type': 'application/json' } }),
    ],
    ['an oversized success body', () => Response.json({ ...active, padding: 'x'.repeat(16_384) })],
  ] as const)('maps %s to unavailability', async (_label, response) => {
    const { authority, fetcher } = setup();
    fetcher.mockResolvedValue(response());

    await expect(authority.find(organizationId, userId)).rejects.toMatchObject(unavailable);
  });

  it('maps a transport error to unavailability and can use a subsequent proof', async () => {
    const { authority, fetcher } = setup();
    fetcher
      .mockRejectedValueOnce(new Error('upstream fixture'))
      .mockResolvedValueOnce(Response.json(active));

    await expect(authority.find(organizationId, userId)).rejects.toMatchObject(unavailable);
    await expect(authority.find(organizationId, userId)).resolves.toMatchObject({
      memberId,
      role: 'member',
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('uses the request deadline while reading the response body', async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    const fetcher = vi.fn<typeof fetch>((_input, init) => {
      const stream = new ReadableStream<Uint8Array>({
        start(body) {
          init?.signal?.addEventListener(
            'abort',
            () => {
              body.error(new Error('timed out'));
            },
            { once: true },
          );
          queueMicrotask(() => {
            controller.abort();
          });
        },
      });
      return Promise.resolve(
        new Response(stream, { headers: { 'content-type': 'application/json' } }),
      );
    });

    await expect(setup(fetcher).authority.find(organizationId, userId)).rejects.toMatchObject(
      unavailable,
    );
    expect(timeout).toHaveBeenCalledExactlyOnceWith(1_000);
  });
});
