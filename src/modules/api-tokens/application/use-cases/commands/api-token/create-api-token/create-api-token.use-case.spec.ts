import { describe, expect, it } from 'vitest';

import { FakeApiTokenSecrets, FixedClock, InMemoryApiTokens } from '../api-tokens.fixture.js';
import type { CreateApiTokenOutput } from './create-api-token.output.js';
import { CreateApiToken } from './create-api-token.use-case.js';

const ATELIER_NORD = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';
const CAMILLE_ID = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';

describe('CreateApiToken', () => {
  it('stores the token in the organization of the session with the hash of its secret only', async () => {
    const store: InMemoryApiTokens = new InMemoryApiTokens();
    const created: CreateApiTokenOutput = await new CreateApiToken(
      store,
      new FakeApiTokenSecrets(),
      new FixedClock('2026-11-08T14:02:00Z'),
    ).execute({
      actorUserId: CAMILLE_ID,
      organizationId: ATELIER_NORD,
      name: ' Synchronisation GitLab ',
      scopes: ['tasks:read', 'tasks:read'],
      expiration: '30-days',
    });

    expect(created).toEqual({
      apiToken: {
        id: '019a6c30-7a8b-7c9d-8e0f-000000000001',
        name: 'Synchronisation GitLab',
        prefix: 'cw_pat_Test',
        scopes: ['tasks:read'],
        organizationId: ATELIER_NORD,
        createdAt: new Date('2026-11-08T14:02:00Z'),
        expiresAt: new Date('2026-12-08T14:02:00Z'),
        lastUsedAt: null,
      },
      secret: expect.stringMatching(/^cw_pat_[0-9A-Za-z]{36}$/u) as unknown,
    });
    const stored = store.rows.get(created.apiToken.id);
    expect(stored?.tokenHash).toBe(`hash:${created.secret}`);
    expect(JSON.stringify(stored?.state)).not.toContain(created.secret);
    expect(stored?.state).toMatchObject({ userId: CAMILLE_ID, version: 1, revokedAt: null });
  });
});
