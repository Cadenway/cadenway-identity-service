import { describe, expect, it, vi } from 'vitest';

import { OrganizationDeletionAuthority } from './organization-deletion-authority.adapter.js';

const userId = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';
const attemptId = '019a6c30-7a8b-7c9d-8e0f-1a2b3c4d8e91';
const origin = 'https://organization.example.test';

describe('OrganizationDeletionAuthority', () => {
  it.each([201, 204])('accepts only the signed attempt and a %s confirmation', async (status) => {
    const sign = vi.fn().mockResolvedValue('internal-fixture');
    const http = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status }));

    await expect(
      new OrganizationDeletionAuthority(origin, { sign }, http).reserve(userId, attemptId),
    ).resolves.toBe('reserved');
    expect(sign).toHaveBeenCalledWith('organization-service', {
      actor: { type: 'system', id: 'identity-service' },
      organizationId: null,
      scopes: [],
    });
    expect(http).toHaveBeenCalledWith(
      new URL(`/internal/v1/users/${userId}/account-deletion-reservations/${attemptId}`, origin),
      expect.objectContaining({
        method: 'PUT',
        redirect: 'error',
        cache: 'no-store',
      }),
    );
    expect(http.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('distinguishes the definitive owner refusal from every other conflict', async () => {
    const ownerProblem = {
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      code: 'account.organization-owner',
      details: { organizationIds: [userId] },
    };
    const problem = (payload: object): Response =>
      new Response(JSON.stringify(payload), {
        status: 409,
        headers: { 'Content-Type': 'application/problem+json' },
      });
    const http = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(problem(ownerProblem))
      .mockResolvedValueOnce(
        problem({ ...ownerProblem, code: 'account.deletion-reservation-conflict' }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const authority = new OrganizationDeletionAuthority(
      origin,
      { sign: vi.fn().mockResolvedValue('internal-fixture') },
      http,
    );

    await expect(authority.reserve(userId, attemptId)).resolves.toBe('owner');
    await expect(authority.reserve(userId, attemptId)).rejects.toThrow('authority unavailable');
    await expect(authority.reserve(userId, attemptId)).rejects.toThrow('authority unavailable');
  });
});
