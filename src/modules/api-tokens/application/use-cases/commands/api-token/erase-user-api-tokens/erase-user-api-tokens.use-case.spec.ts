import { describe, expect, it } from 'vitest';

import {
  FakeApiTokenSecrets,
  FakeRecentAuthentications,
  FixedClock,
  InMemoryApiTokens,
} from '../api-tokens.fixture.js';
import { CreateApiToken } from '../create-api-token/create-api-token.use-case.js';
import { EraseUserApiTokens } from './erase-user-api-tokens.use-case.js';

/**
 * Constant CAMILLE_ID
 *
 * @description
 * Id of the account of Camille Martin.
 *
 * @type {string}
 */
const CAMILLE_ID: string = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';

/**
 * Constant LEA_ID
 *
 * @description
 * Id of the account of another member.
 *
 * @type {string}
 */
const LEA_ID: string = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b31';

describe('EraseUserApiTokens', () => {
  it('deletes every token of a deleted account, in every organization, and no other', async () => {
    const store: InMemoryApiTokens = new InMemoryApiTokens();
    const create: CreateApiToken = new CreateApiToken(
      store,
      new FakeApiTokenSecrets(),
      new FakeRecentAuthentications('recent'),
      new FixedClock('2026-11-08T14:02:00Z'),
    );
    for (const [userId, organizationId] of [
      [CAMILLE_ID, '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f'],
      [CAMILLE_ID, '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2e'],
      [LEA_ID, '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f'],
    ] as const) {
      await create.execute({
        actorUserId: userId,
        organizationId,
        sessionId: '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60',
        name: 'Synchronisation GitLab',
        scopes: ['tasks:read'],
        expiration: '30-days',
      });
    }

    await new EraseUserApiTokens(store).execute({ userId: CAMILLE_ID });

    expect([...store.rows.values()].map((row) => row.state.userId)).toEqual([LEA_ID]);
  });
});
