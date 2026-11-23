import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import { CodeRequestThrottle } from '../../../../../domain/policies/one-time-codes/code-request-throttle.policy.js';
import { PasswordResetThrottle } from '../../../../../domain/policies/password-reset/password-reset-throttle.policy.js';
import { PasswordLockout } from '../../../../../domain/policies/password/password-lockout.policy.js';
import {
  FakeAccountApiTokens,
  FakeAccountSessions,
  FixedClock,
  InMemoryAccounts,
} from '../../../../models/accounts/accounts.fixture.js';
import type { AccountDeletionAuthority } from '../../../../ports/outbound/memberships/accounts/account-deletion-authority.port.js';
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
  const reserve = vi.fn<AccountDeletionAuthority['reserve']>();
  let complete: CompleteAccountDeletion;
  let camille: User;

  beforeEach(() => {
    accounts = new InMemoryAccounts();
    clock = new FixedClock('2026-12-09T15:40:00Z');
    sessions = new FakeAccountSessions(clock);
    apiTokens = new FakeAccountApiTokens();
    reserve.mockReset().mockResolvedValue('reserved');
    complete = new CompleteAccountDeletion(accounts, sessions, apiTokens, { reserve }, clock);
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
    reserve.mockResolvedValue('owner');

    await expect(complete.execute({ userId: camille.id })).resolves.toEqual({ outcome: 'kept' });

    expect(accounts.state.users.get(camille.id)?.deleteAt).toEqual(DELETE_AT);
    expect(accounts.state.deletionChecks.get(camille.id)).toEqual(clock.now());
    expect(accounts.state.deletionAttempts.has(camille.id)).toBe(false);
    expect(sessions.erased).toEqual([]);
    expect(accounts.state.events).toEqual([]);
  });

  it('keeps the durable attempt on an uncertain response and retries it after commit', async () => {
    reserve.mockRejectedValueOnce(new Error('Authority unavailable.'));
    await expect(complete.execute({ userId: camille.id })).rejects.toThrow(
      'Authority unavailable.',
    );
    const attemptId = accounts.state.deletionAttempts.get(camille.id);
    expect(attemptId).toEqual(expect.any(String));
    expect(accounts.state.users.has(camille.id)).toBe(true);
    expect(accounts.state.events).toEqual([]);

    await expect(complete.execute({ userId: camille.id })).resolves.toEqual({ outcome: 'deleted' });
    expect(reserve.mock.calls).toEqual([
      [camille.id, attemptId],
      [camille.id, attemptId],
    ]);
    expect(accounts.state.events).toHaveLength(1);
  });

  it('honors the current ownership when an earlier reservation cannot be replayed after recovery', async () => {
    reserve
      .mockRejectedValueOnce(new Error('Confirmation missing.'))
      .mockResolvedValueOnce('owner');
    await expect(complete.execute({ userId: camille.id })).rejects.toThrow('Confirmation missing.');
    const attemptId = accounts.state.deletionAttempts.get(camille.id);

    await expect(complete.execute({ userId: camille.id })).resolves.toEqual({ outcome: 'kept' });
    expect(reserve.mock.calls).toEqual([
      [camille.id, attemptId],
      [camille.id, attemptId],
    ]);
    expect(accounts.state.users.has(camille.id)).toBe(true);
    expect(accounts.state.deletionAttempts.has(camille.id)).toBe(false);
    expect(accounts.state.events).toEqual([]);
  });

  it('does nothing before deleteAt, after a cancellation, or for an account already gone', async () => {
    const early: CompleteAccountDeletion = new CompleteAccountDeletion(
      accounts,
      sessions,
      apiTokens,
      { reserve },
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
