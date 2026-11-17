import { beforeEach, describe, expect, it } from 'vitest';

import { ApiTokenNotFound } from '../../../../models/api-token/api-token-not-found.model.js';
import { FakeApiTokenSecrets, FixedClock, InMemoryApiTokens } from '../api-tokens.fixture.js';
import { CreateApiToken } from '../create-api-token/create-api-token.use-case.js';
import { RevokeApiToken } from './revoke-api-token.use-case.js';

const ATELIER_NORD = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';
const OTHER_ORGANIZATION = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2e';
const CAMILLE_ID = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';
const LEA_ID = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b31';

describe('RevokeApiToken', () => {
  let store: InMemoryApiTokens;
  let clock: FixedClock;
  let revoke: RevokeApiToken;
  let tokenId: string;

  beforeEach(async () => {
    store = new InMemoryApiTokens();
    clock = new FixedClock('2026-11-08T14:02:00Z');
    revoke = new RevokeApiToken(store, clock);
    const created = await new CreateApiToken(store, new FakeApiTokenSecrets(), clock).execute({
      actorUserId: CAMILLE_ID,
      organizationId: ATELIER_NORD,
      name: 'Synchronisation GitLab',
      scopes: ['tasks:read'],
      expiration: 'never',
    });
    tokenId = created.apiToken.id;
  });

  it('revokes a token of the caller with the next version, and changes nothing the second time', async () => {
    clock.advance(60_000);
    const input = { actorUserId: CAMILLE_ID, organizationId: ATELIER_NORD, apiTokenId: tokenId };

    await revoke.execute(input);
    clock.advance(60_000);
    await revoke.execute(input);

    expect(store.rows.get(tokenId)?.state).toMatchObject({
      revokedAt: new Date('2026-11-08T14:03:00Z'),
      version: 2,
    });
  });

  it('refuses a token of another user, of another organization, and an unknown id', async () => {
    for (const input of [
      { actorUserId: LEA_ID, organizationId: ATELIER_NORD, apiTokenId: tokenId },
      { actorUserId: CAMILLE_ID, organizationId: OTHER_ORGANIZATION, apiTokenId: tokenId },
      {
        actorUserId: CAMILLE_ID,
        organizationId: ATELIER_NORD,
        apiTokenId: '019a6c30-7a8b-7c9d-8e0f-ffffffffffff',
      },
    ]) {
      await expect(revoke.execute(input)).rejects.toThrow(ApiTokenNotFound);
    }
    expect(store.rows.get(tokenId)?.state.revokedAt).toBeNull();
  });
});
