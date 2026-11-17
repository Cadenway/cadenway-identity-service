import { beforeEach, describe, expect, it } from 'vitest';

import {
  FakeApiTokenSecrets,
  FakeRecentAuthentications,
  FixedClock,
  InMemoryApiTokens,
} from '../../../commands/api-token/api-tokens.fixture.js';
import { CreateApiToken } from '../../../commands/api-token/create-api-token/create-api-token.use-case.js';
import { RevokeApiToken } from '../../../commands/api-token/revoke-api-token/revoke-api-token.use-case.js';
import type { ListApiTokensOutput } from './list-api-tokens.output.js';
import { ListApiTokens } from './list-api-tokens.use-case.js';

const ATELIER_NORD = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';
const OTHER_ORGANIZATION = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2e';
const CAMILLE_ID = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';
const SESSION_ID = '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60';
const LEA_ID = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b31';
const DAY = 24 * 60 * 60_000;

describe('ListApiTokens', () => {
  let store: InMemoryApiTokens;
  let clock: FixedClock;
  let create: CreateApiToken;
  let list: ListApiTokens;

  /**
   * Creates a token and moves the clock a minute on.
   *
   * @param name - Its name.
   * @param userId - Its user.
   * @param organizationId - Its organization.
   * @returns Its id.
   */
  async function token(
    name: string,
    userId: string = CAMILLE_ID,
    organizationId: string = ATELIER_NORD,
  ): Promise<string> {
    const created = await create.execute({
      actorUserId: userId,
      organizationId,
      sessionId: SESSION_ID,
      name,
      scopes: ['tasks:read'],
      expiration: '30-days',
    });
    clock.advance(60_000);
    return created.apiToken.id;
  }

  beforeEach(() => {
    store = new InMemoryApiTokens();
    clock = new FixedClock('2026-11-08T14:02:00Z');
    create = new CreateApiToken(
      store,
      new FakeApiTokenSecrets(),
      new FakeRecentAuthentications('recent'),
      clock,
    );
    list = new ListApiTokens(store, clock);
  });

  it('lists the active tokens of the caller in its organization, the most recent first', async () => {
    const first: string = await token('GitLab');
    const revoked: string = await token('CI');
    const last: string = await token('Zapier');
    await token('Léa', LEA_ID);
    await token('Ailleurs', CAMILLE_ID, OTHER_ORGANIZATION);
    await new RevokeApiToken(store, clock).execute({
      actorUserId: CAMILLE_ID,
      organizationId: ATELIER_NORD,
      apiTokenId: revoked,
    });

    const page: ListApiTokensOutput = await list.execute({
      actorUserId: CAMILLE_ID,
      organizationId: ATELIER_NORD,
      after: null,
      limit: 50,
    });

    expect(page.items.map((item) => item.id)).toEqual([last, first]);
    expect(page.next).toBeNull();
  });

  it('leaves out the expired tokens', async () => {
    await token('GitLab');
    clock.advance(30 * DAY);

    await expect(
      list.execute({
        actorUserId: CAMILLE_ID,
        organizationId: ATELIER_NORD,
        after: null,
        limit: 50,
      }),
    ).resolves.toEqual({ items: [], next: null });
  });

  it('pages after the position of the last token of the previous page', async () => {
    const ids: string[] = [];
    for (const name of ['A', 'B', 'C']) {
      ids.push(await token(name));
    }

    const first: ListApiTokensOutput = await list.execute({
      actorUserId: CAMILLE_ID,
      organizationId: ATELIER_NORD,
      after: null,
      limit: 2,
    });
    const second: ListApiTokensOutput = await list.execute({
      actorUserId: CAMILLE_ID,
      organizationId: ATELIER_NORD,
      after: first.next,
      limit: 2,
    });

    expect(first.items.map((item) => item.id)).toEqual([ids[2], ids[1]]);
    expect(first.next).toEqual({ createdAt: new Date('2026-11-08T14:03:00Z'), id: ids[1] });
    expect(second.items.map((item) => item.id)).toEqual([ids[0]]);
    expect(second.next).toBeNull();
  });
});
