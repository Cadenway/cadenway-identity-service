import { beforeEach, describe, expect, it } from 'vitest';

import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import { PasswordLockout } from '../../../../../domain/policies/password/password-lockout.policy.js';
import { EmailAddress } from '../../../../../domain/value-objects/email/email-address.value-object.js';
import {
  FakeAccountSessions,
  FakeCompromisedPasswords,
  FakeDeviceReader,
  FakePasswordHasher,
  FakeResetLinkSecrets,
  FixedClock,
  InMemoryAccounts,
} from '../../../../models/accounts/accounts.fixture.js';
import { RequestPasswordReset } from '../request-password-reset/request-password-reset.use-case.js';
import type { ConfirmPasswordResetInput } from './confirm-password-reset.input.js';
import { ConfirmPasswordReset } from './confirm-password-reset.use-case.js';

/**
 * Constant CONFIRMATION
 *
 * @description
 * "Enregistrer le mot de passe" with the first link of the specs, other sessions closed.
 *
 * @type {ConfirmPasswordResetInput}
 */
const CONFIRMATION: ConfirmPasswordResetInput = {
  token: 'reset-token-1',
  newPassword: 'nord-atelier-sprint-15',
  closeOtherSessions: true,
  client: { ipAddress: '192.0.2.14', userAgent: 'Mozilla/5.0 Firefox/132.0' },
};

describe('ConfirmPasswordReset', () => {
  let accounts: InMemoryAccounts;
  let clock: FixedClock;
  let sessions: FakeAccountSessions;
  let confirm: ConfirmPasswordReset;
  let camille: User;

  beforeEach(async () => {
    accounts = new InMemoryAccounts();
    clock = new FixedClock('2026-11-09T13:10:00Z');
    const secrets: FakeResetLinkSecrets = new FakeResetLinkSecrets();
    sessions = new FakeAccountSessions(clock);
    confirm = new ConfirmPasswordReset(
      accounts,
      new FakePasswordHasher(),
      new FakeCompromisedPasswords(['motdepasse123']),
      secrets,
      sessions,
      new FakeDeviceReader(),
      clock,
    );
    camille = accounts.seedUser(
      'camille.martin@ateliernord.fr',
      true,
      'hashed:atelier-nord-sprint-14',
      new Date('2026-12-01T10:00:00Z'),
    );
    for (const id of ['000000000001', '000000000002', '000000000003']) {
      sessions.seed(`019a6a2e-4b1c-7d3e-8f5a-${id}`, camille.id, clock.now());
    }
    await new RequestPasswordReset(accounts, secrets, new FakeDeviceReader(), clock).execute({
      email: camille.email.value,
      client: { ipAddress: '192.0.2.14', userAgent: null },
    });
    clock.advance(5 * 60_000);
  });

  it('sets the new password, uses the link up and closes every session', async () => {
    await expect(confirm.execute(CONFIRMATION)).resolves.toEqual({
      email: 'camille.martin@ateliernord.fr',
      closedSessionCount: 3,
    });

    expect(accounts.state.credentials.get(camille.id)).toBe('hashed:nord-atelier-sprint-15');
    expect(accounts.state.resetLinks[0]?.usedAt).toEqual(new Date('2026-11-09T13:15:00Z'));
    await expect(sessions.countOpen(camille.id)).resolves.toBe(0);
    const user: User | undefined = accounts.state.users.get(camille.id);
    expect(user?.version).toBe(camille.version + 1);
    expect(user?.passwordChangedAt).toEqual(new Date('2026-11-09T13:15:00Z'));
    expect(accounts.state.events.at(-1)).toMatchObject({
      name: 'user.password-changed.v1',
      method: 'reset',
      closedSessionCount: 3,
      client: { ipAddress: '192.0.2.14', device: { browser: 'Firefox' } },
    });
    await expect(confirm.execute(CONFIRMATION)).rejects.toMatchObject({
      refusal: { reason: 'reset-link-expired' },
    });
  });

  it('leaves the sessions open when asked, without their recent authentication', async () => {
    await expect(
      confirm.execute({ ...CONFIRMATION, closeOtherSessions: false }),
    ).resolves.toMatchObject({ closedSessionCount: 0 });

    await expect(sessions.countOpen(camille.id)).resolves.toBe(3);
    await expect(sessions.check(camille.id, '019a6a2e-4b1c-7d3e-8f5a-000000000001')).resolves.toBe(
      'stale',
    );
  });

  it('checks the link first, then the new password, which leaves the link usable', async () => {
    await expect(
      confirm.execute({ ...CONFIRMATION, token: 'reset-token-9', newPassword: 'short' }),
    ).rejects.toMatchObject({ refusal: { reason: 'reset-link-expired' } });
    await expect(confirm.execute({ ...CONFIRMATION, newPassword: 'short' })).rejects.toMatchObject({
      refusal: { reason: 'password-too-short', minLength: 12 },
    });
    await expect(
      confirm.execute({ ...CONFIRMATION, newPassword: 'motdepasse123' }),
    ).rejects.toMatchObject({ refusal: { reason: 'password-compromised' } });

    expect(accounts.state.resetLinks[0]?.usedAt).toBeNull();
    await expect(confirm.execute(CONFIRMATION)).resolves.toBeDefined();
  });

  it('refuses a malformed token and an expired link', async () => {
    await expect(confirm.execute({ ...CONFIRMATION, token: 'malformed' })).rejects.toMatchObject({
      refusal: { reason: 'reset-link-expired' },
    });
    clock.advance(25 * 60_000);
    await expect(confirm.execute(CONFIRMATION)).rejects.toMatchObject({
      refusal: { reason: 'reset-link-expired' },
    });
  });

  it('ends the lockout, drops a pending change of address and keeps the scheduled deletion', async () => {
    accounts.state.lockouts.set(
      camille.email.value,
      PasswordLockout.restore({
        failedAttempts: 5,
        lockedUntil: new Date('2026-11-09T13:30:00Z'),
      }),
    );
    accounts.state.emailChanges.set(camille.id, {
      userId: camille.id,
      sessionId: '019a6a2e-4b1c-7d3e-8f5a-000000000001',
      email: EmailAddress.of('camille@ateliernord.fr'),
    });

    await confirm.execute(CONFIRMATION);

    expect(accounts.state.lockouts.has(camille.email.value)).toBe(false);
    expect(accounts.state.emailChanges.has(camille.id)).toBe(false);
    expect(accounts.state.users.get(camille.id)?.deleteAt).toEqual(
      new Date('2026-12-01T10:00:00Z'),
    );
  });
});
