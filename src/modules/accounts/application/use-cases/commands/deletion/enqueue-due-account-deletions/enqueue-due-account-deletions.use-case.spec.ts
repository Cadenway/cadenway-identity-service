import { beforeEach, describe, expect, it } from 'vitest';

import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import { FixedClock, InMemoryAccounts } from '../../../../models/accounts/accounts.fixture.js';
import { EnqueueDueAccountDeletions } from './enqueue-due-account-deletions.use-case.js';

/**
 * Constant DELETE_AT
 *
 * @description
 * When the deletion of Camille Martin takes effect.
 *
 * @type {Date}
 */
const DELETE_AT: Date = new Date('2026-12-09T15:30:00Z');

describe('EnqueueDueAccountDeletions', () => {
  let accounts: InMemoryAccounts;
  let clock: FixedClock;
  let sweep: EnqueueDueAccountDeletions;
  let camille: User;

  beforeEach(() => {
    accounts = new InMemoryAccounts();
    clock = new FixedClock('2026-12-09T15:40:00Z');
    sweep = new EnqueueDueAccountDeletions(accounts, clock);
    camille = accounts.seedUser('camille.martin@ateliernord.fr', true, 'hashed:x', DELETE_AT);
  });

  it('enqueues one job per due deletion, keyed by the account and the instant it became due', async () => {
    accounts.seedUser('later@ateliernord.fr', true, 'hashed:x', new Date('2026-12-10T08:00:00Z'));
    accounts.seedUser('kept@ateliernord.fr', true, 'hashed:x');

    await expect(sweep.execute()).resolves.toEqual({ claimed: 1, enqueued: 1 });
    expect(accounts.state.deletionJobs).toEqual([`${camille.id}:2026-12-09T15:30:00.000Z`]);
  });

  it('enqueues nothing more on a doubled sweep', async () => {
    await sweep.execute();
    clock.advance(10 * 60_000);

    await expect(sweep.execute()).resolves.toEqual({ claimed: 1, enqueued: 0 });
    expect(accounts.state.deletionJobs).toHaveLength(1);
  });

  it('checks a kept deletion again an hour after its check, as a new occurrence', async () => {
    const checkedAt: Date = new Date('2026-12-09T15:45:00Z');
    accounts.state.deletionChecks.set(camille.id, checkedAt);
    clock.advance(30 * 60_000);

    await expect(sweep.execute()).resolves.toEqual({ claimed: 0, enqueued: 0 });

    clock.advance(35 * 60_000);
    await expect(sweep.execute()).resolves.toEqual({ claimed: 1, enqueued: 1 });
    expect(accounts.state.deletionJobs).toEqual([`${camille.id}:2026-12-09T15:45:00.000Z`]);
  });

  it('claims nothing before the deletion is due', async () => {
    const early: EnqueueDueAccountDeletions = new EnqueueDueAccountDeletions(
      accounts,
      new FixedClock('2026-12-09T15:29:59Z'),
    );

    await expect(early.execute()).resolves.toEqual({ claimed: 0, enqueued: 0 });
  });
});
