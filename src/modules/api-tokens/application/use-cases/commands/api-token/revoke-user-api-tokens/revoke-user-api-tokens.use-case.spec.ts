import { beforeEach, describe, expect, it } from 'vitest';

import {
  FakeApiTokenSecrets,
  FakeRecentAuthentications,
  FixedClock,
  InMemoryApiTokens,
} from '../api-tokens.fixture.js';
import { CreateApiToken } from '../create-api-token/create-api-token.use-case.js';
import { RevokeApiToken } from '../revoke-api-token/revoke-api-token.use-case.js';
import { RevokeUserApiTokens } from './revoke-user-api-tokens.use-case.js';

/**
 * Constant ATELIER_NORD
 *
 * @description
 * The organization of the first tokens.
 *
 * @type {string}
 */
const ATELIER_NORD: string = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';

/**
 * Constant OTHER_ORGANIZATION
 *
 * @description
 * Another organization of Camille Martin.
 *
 * @type {string}
 */
const OTHER_ORGANIZATION: string = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2e';

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

describe('RevokeUserApiTokens', () => {
  let store: InMemoryApiTokens;
  let clock: FixedClock;
  let ids: string[];

  beforeEach(async () => {
    store = new InMemoryApiTokens();
    clock = new FixedClock('2026-11-08T14:02:00Z');
    const create: CreateApiToken = new CreateApiToken(
      store,
      new FakeApiTokenSecrets(),
      new FakeRecentAuthentications('recent'),
      clock,
    );
    ids = [];
    for (const [userId, organizationId] of [
      [CAMILLE_ID, ATELIER_NORD],
      [CAMILLE_ID, OTHER_ORGANIZATION],
      [CAMILLE_ID, ATELIER_NORD],
      [LEA_ID, ATELIER_NORD],
    ] as const) {
      const created = await create.execute({
        actorUserId: userId,
        organizationId,
        sessionId: '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60',
        name: 'Synchronisation GitLab',
        scopes: ['tasks:read'],
        expiration: 'never',
      });
      ids.push(created.apiToken.id);
    }
    await new RevokeApiToken(store, clock).execute({
      actorUserId: CAMILLE_ID,
      organizationId: ATELIER_NORD,
      apiTokenId: ids[2] ?? '',
    });
    clock.advance(60_000);
  });

  it('revokes every token of the person, in every organization, with the next version', async () => {
    await expect(
      new RevokeUserApiTokens(store, clock).execute({ userId: CAMILLE_ID }),
    ).resolves.toEqual({ revokedCount: 2 });

    for (const id of [ids[0], ids[1]]) {
      expect(store.rows.get(id ?? '')?.state).toMatchObject({
        revokedAt: new Date('2026-11-08T14:03:00Z'),
        version: 2,
      });
    }
    expect(store.rows.get(ids[2] ?? '')?.state).toMatchObject({
      revokedAt: new Date('2026-11-08T14:02:00Z'),
      version: 2,
    });
    expect(store.rows.get(ids[3] ?? '')?.state.revokedAt).toBeNull();
  });

  it('revokes nothing the second time', async () => {
    await new RevokeUserApiTokens(store, clock).execute({ userId: CAMILLE_ID });

    await expect(
      new RevokeUserApiTokens(store, clock).execute({ userId: CAMILLE_ID }),
    ).resolves.toEqual({ revokedCount: 0 });
  });
});
