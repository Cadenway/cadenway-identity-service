import { beforeEach, describe, expect, it } from 'vitest';

import type { User } from '../../domain/user.js';
import { InMemoryAccounts } from '../accounts.fixture.js';
import { GetUser } from './get-user.js';

describe('GetUser', () => {
  let accounts: InMemoryAccounts;
  let camille: User;

  beforeEach(() => {
    accounts = new InMemoryAccounts();
    camille = accounts.seedUser('camille.martin@ateliernord.fr', true, 'hashed:x');
  });

  it('reads the account of the actor', async () => {
    await expect(
      new GetUser(accounts).execute({ actorUserId: camille.id, userId: camille.id }),
    ).resolves.toEqual({
      id: camille.id,
      name: 'Camille Martin',
      email: 'camille.martin@ateliernord.fr',
      language: 'fr',
      version: 2,
    });
  });

  it('answers not found for another account and for an unknown one', async () => {
    const other: User = accounts.seedUser('lea@ateliernord.fr', true, 'hashed:x');
    const unknown: string = '019a5f3c-8d2e-7c4a-9b1f-ffffffffffff';

    await expect(
      new GetUser(accounts).execute({ actorUserId: other.id, userId: camille.id }),
    ).rejects.toMatchObject({ refusal: { reason: 'user-not-found' } });
    await expect(
      new GetUser(accounts).execute({ actorUserId: unknown, userId: unknown }),
    ).rejects.toMatchObject({ refusal: { reason: 'user-not-found' } });
  });
});
