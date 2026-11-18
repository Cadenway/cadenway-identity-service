import { beforeEach, describe, expect, it } from 'vitest';

import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import { InMemoryAccounts } from '../../../../models/accounts/accounts.fixture.js';
import { UpdateUserProfile } from './update-user-profile.use-case.js';

describe('UpdateUserProfile', () => {
  let accounts: InMemoryAccounts;
  let camille: User;
  let update: UpdateUserProfile;

  beforeEach(() => {
    accounts = new InMemoryAccounts();
    camille = accounts.seedUser('camille.martin@ateliernord.fr', true, 'hashed:x');
    update = new UpdateUserProfile(accounts);
  });

  it('changes the profile of the actor with the next version and appends its event', async () => {
    await expect(
      update.execute({
        actorUserId: camille.id,
        userId: camille.id,
        expectedVersions: [2],
        patch: { displayName: 'camille', jobTitle: 'Responsable produit', language: 'en' },
      }),
    ).resolves.toEqual({
      id: camille.id,
      name: 'Camille Martin',
      email: 'camille.martin@ateliernord.fr',
      language: 'en',
      displayName: 'camille',
      jobTitle: 'Responsable produit',
      timeZone: 'Europe/Paris',
      version: 3,
      passwordChangedAt: new Date('2026-08-12T09:30:00Z'),
    });
    expect(accounts.state.users.get(camille.id)?.version).toBe(3);
    expect(accounts.state.events).toEqual([
      {
        name: 'user.profile-updated.v1',
        user: accounts.state.users.get(camille.id),
        changed: ['displayName', 'jobTitle', 'language'],
      },
    ]);
  });

  it('answers the same version and appends nothing for a patch that changes nothing', async () => {
    const view = await update.execute({
      actorUserId: camille.id,
      userId: camille.id,
      expectedVersions: null,
      patch: { name: 'Camille Martin' },
    });

    expect(view.version).toBe(2);
    expect(accounts.state.events).toEqual([]);
  });

  it('refuses a version If-Match does not accept, with the current one, and changes nothing', async () => {
    await expect(
      update.execute({
        actorUserId: camille.id,
        userId: camille.id,
        expectedVersions: [1],
        patch: { jobTitle: 'CTO' },
      }),
    ).rejects.toMatchObject({ refusal: { reason: 'version-mismatch', version: 2 } });
    expect(accounts.state.users.get(camille.id)?.jobTitle).toBeNull();
    expect(accounts.state.events).toEqual([]);
  });

  it('answers not found for another account and for an unknown one', async () => {
    const other: User = accounts.seedUser('lea@ateliernord.fr', true, 'hashed:x');
    const unknown = '019a5f3c-8d2e-7c4a-9b1f-ffffffffffff';

    await expect(
      update.execute({
        actorUserId: other.id,
        userId: camille.id,
        expectedVersions: null,
        patch: { jobTitle: 'CTO' },
      }),
    ).rejects.toMatchObject({ refusal: { reason: 'user-not-found' } });
    await expect(
      update.execute({ actorUserId: unknown, userId: unknown, expectedVersions: null, patch: {} }),
    ).rejects.toMatchObject({ refusal: { reason: 'user-not-found' } });
  });
});
