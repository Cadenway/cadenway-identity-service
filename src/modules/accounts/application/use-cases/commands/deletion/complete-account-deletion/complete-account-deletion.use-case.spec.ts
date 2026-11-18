import { beforeEach, describe, expect, it } from 'vitest';

import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import { CodeRequestThrottle } from '../../../../../domain/policies/one-time-codes/code-request-throttle.policy.js';
import { PasswordResetThrottle } from '../../../../../domain/policies/password-reset/password-reset-throttle.policy.js';
import { PasswordLockout } from '../../../../../domain/policies/password/password-lockout.policy.js';
import {
  FakeAccountApiTokens,
  FakeAccountSessions,
  FakeOwnedOrganizations,
  FixedClock,
  InMemoryAccounts,
} from '../../../../models/accounts/accounts.fixture.js';
import { CompleteAccountDeletion } from './complete-account-deletion.use-case.js';

/**
 * Constant DELETE_AT
 *
 * @description
 * When the deletion of Camille Martin takes effect.
 *
 * @type {Date}
 */
const DELETE_AT: Date = new Date('2026-12-09T15:30:00Z');

describe('CompleteAccountDeletion', () => {
  let accounts: InMemoryAccounts;
  let clock: FixedClock;
  let sessions: FakeAccountSessions;
  let apiTokens: FakeAccountApiTokens;
  let owned: FakeOwnedOrganizations;
  let complete: CompleteAccountDeletion;
  let camille: User;

  beforeEach(() => {
    accounts = new InMemoryAccounts();
    clock = new FixedClock('2026-12-09T15:40:00Z');
    sessions = new FakeAccountSessions(clock);
    apiTokens = new FakeAccountApiTokens();
    owned = new FakeOwnedOrganizations();
    complete = new CompleteAccountDeletion(accounts, sessions, apiTokens, owned, clock);
    camille = accounts.seedUser('camille.martin@ateliernord.fr', true, 'hashed:x', DELETE_AT);
  });

  it('erases the account and what names it, and appends user.deleted.v1 with the next version', async () => {
    const address: string = camille.email.value;
    accounts.state.codeRequests.set(
      address,
      CodeRequestThrottle.none().accept(clock.now()).throttle,
    );
    accounts.state.resetRequests.set(
      address,
      PasswordResetThrottle.none().accept(clock.now()).throttle,
    );
    accounts.state.lockouts.set(
      address,
      PasswordLockout.clear().recordFailure(clock.now()).lockout,
    );

    await expect(complete.execute({ userId: camille.id })).resolves.toEqual({
      outcome: 'deleted',
    });

    expect(accounts.state.users.has(camille.id)).toBe(false);
    expect(accounts.state.credentials.has(camille.id)).toBe(false);
    expect(sessions.erased).toEqual([camille.id]);
    expect(apiTokens.erased).toEqual([camille.id]);
    expect(accounts.state.codeRequests.has(address)).toBe(false);
    expect(accounts.state.resetRequests.has(address)).toBe(false);
    expect(accounts.state.lockouts.has(address)).toBe(false);
    expect(accounts.state.events).toEqual([
      { name: 'user.deleted.v1', userId: camille.id, version: camille.version + 1 },
    ]);
  });

  it('keeps an account that owns an organization at deleteAt, and records the check', async () => {
    owned.owned.set(camille.id, ['019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f']);

    await expect(complete.execute({ userId: camille.id })).resolves.toEqual({ outcome: 'kept' });

    expect(accounts.state.users.get(camille.id)?.deleteAt).toEqual(DELETE_AT);
    expect(accounts.state.deletionChecks.get(camille.id)).toEqual(clock.now());
    expect(sessions.erased).toEqual([]);
    expect(accounts.state.events).toEqual([]);
  });

  it('does nothing before deleteAt, after a cancellation, or for an account already gone', async () => {
    const early: CompleteAccountDeletion = new CompleteAccountDeletion(
      accounts,
      sessions,
      apiTokens,
      owned,
      new FixedClock('2026-12-09T15:29:00Z'),
    );
    await expect(early.execute({ userId: camille.id })).resolves.toEqual({ outcome: 'not-due' });

    const cancelled: User = accounts.seedUser('cancelled@ateliernord.fr', true, 'hashed:x');
    await expect(complete.execute({ userId: cancelled.id })).resolves.toEqual({
      outcome: 'not-due',
    });

    await complete.execute({ userId: camille.id });
    await expect(complete.execute({ userId: camille.id })).resolves.toEqual({
      outcome: 'not-due',
    });
    expect(accounts.state.events).toHaveLength(1);
  });
});
