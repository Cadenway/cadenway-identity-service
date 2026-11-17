import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import { EmailAddress } from '../../../../../domain/value-objects/email/email-address.value-object.js';
import {
  FakeAccountSessions,
  FakeCompromisedPasswords,
  FakeDeviceReader,
  FakePasswordHasher,
  FixedClock,
  InMemoryAccounts,
} from '../../../../models/accounts/accounts.fixture.js';
import type { RecordedEvent } from '../../../../models/accounts/accounts.fixture.js';
import type { AccountView } from '../../../../projections/accounts/account-view.projection.js';
import type { ChangePasswordInput } from './change-password.input.js';
import { ChangePassword } from './change-password.use-case.js';

/**
 * Constant SESSION_ID
 *
 * @description
 * The session the password is changed in.
 *
 * @type {string}
 */
const SESSION_ID: string = '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60';

/**
 * Constant OTHER_SESSION_ID
 *
 * @description
 * Another open session of Camille Martin, on her phone.
 *
 * @type {string}
 */
const OTHER_SESSION_ID: string = '019a6914-2f7a-7b3c-9d4e-5f6a7b8c9d01';

/**
 * Constant CLIENT
 *
 * @description
 * The browser of the change.
 *
 * @type {{ readonly ipAddress: string; readonly userAgent: string }}
 */
const CLIENT: { readonly ipAddress: string; readonly userAgent: string } = {
  ipAddress: '192.0.2.14',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
};

describe('ChangePassword', () => {
  let accounts: InMemoryAccounts;
  let clock: FixedClock;
  let sessions: FakeAccountSessions;
  let change: ChangePassword;
  let camille: User;
  let input: ChangePasswordInput;

  beforeEach(() => {
    accounts = new InMemoryAccounts();
    clock = new FixedClock('2026-11-09T13:16:00Z');
    sessions = new FakeAccountSessions(clock);
    change = new ChangePassword(
      accounts,
      new FakePasswordHasher(),
      new FakeCompromisedPasswords(['motdepasse123']),
      sessions,
      new FakeDeviceReader(),
      clock,
    );
    camille = accounts.seedUser(
      'camille.martin@ateliernord.fr',
      true,
      'hashed:atelier-nord-sprint-14',
    );
    sessions.seed(SESSION_ID, camille.id, null);
    sessions.seed(OTHER_SESSION_ID, camille.id, new Date('2026-11-09T13:15:00Z'));
    input = {
      actorUserId: camille.id,
      userId: camille.id,
      sessionId: SESSION_ID,
      currentPassword: 'atelier-nord-sprint-14',
      newPassword: 'nord-atelier-sprint-15',
      client: CLIENT,
    };
  });

  it('changes the password with the next version, keeping every session open', async () => {
    accounts.state.emailChanges.set(camille.id, {
      userId: camille.id,
      sessionId: SESSION_ID,
      email: EmailAddress.of('camille@ateliernord.fr'),
    });

    const view: AccountView = await change.execute(input);

    expect(view).toMatchObject({
      id: camille.id,
      version: camille.version + 1,
      passwordChangedAt: new Date('2026-11-09T13:16:00Z'),
    });
    expect(accounts.state.credentials.get(camille.id)).toBe('hashed:nord-atelier-sprint-15');
    expect(accounts.state.emailChanges.has(camille.id)).toBe(false);
    await expect(sessions.check(camille.id, SESSION_ID)).resolves.toBe('recent');
    await expect(sessions.check(camille.id, OTHER_SESSION_ID)).resolves.toBe('stale');
    await expect(sessions.countOpen(camille.id)).resolves.toBe(2);
    const event: RecordedEvent | undefined = accounts.state.events.at(-1);
    expect(event).toMatchObject({
      name: 'user.password-changed.v1',
      method: 'change',
      closedSessionCount: 0,
      client: {
        device: { type: 'desktop', browser: 'Firefox', os: 'Windows' },
        ipAddress: '192.0.2.14',
      },
    });
  });

  it('refuses the account of another person, and a session that is not open, first', async () => {
    await expect(
      change.execute({ ...input, userId: '019a5f3c-8d2e-7c4a-9b1f-ffffffffffff' }),
    ).rejects.toMatchObject({ refusal: { reason: 'user-not-found' } });
    await expect(
      change.execute({
        ...input,
        sessionId: '019a6a2e-4b1c-7d3e-8f5a-ffffffffffff',
        newPassword: 'short',
      }),
    ).rejects.toMatchObject({ refusal: { reason: 'session-not-found' } });
    expect(accounts.state.events).toEqual([]);
  });

  it('keeps a password reset during the check of the current one, counting the attempt', async () => {
    const hasher: FakePasswordHasher = new FakePasswordHasher();
    const verify: FakePasswordHasher['verify'] = hasher.verify.bind(hasher);
    vi.spyOn(hasher, 'verify').mockImplementation(
      async (password: string, passwordHash: string | null): Promise<boolean> => {
        const matches: boolean = await verify(password, passwordHash);
        accounts.state.credentials.set(camille.id, 'hashed:reset-by-camille-2026');
        return matches;
      },
    );
    const racing: ChangePassword = new ChangePassword(
      accounts,
      hasher,
      new FakeCompromisedPasswords(),
      sessions,
      new FakeDeviceReader(),
      clock,
    );

    await expect(racing.execute(input)).rejects.toMatchObject({
      refusal: { reason: 'password-incorrect', remainingAttempts: 4 },
    });
    expect(accounts.state.credentials.get(camille.id)).toBe('hashed:reset-by-camille-2026');
    expect(accounts.userByEmail(camille.email.value)?.version).toBe(camille.version);
    await expect(sessions.check(camille.id, SESSION_ID)).resolves.toBe('stale');
  });

  it('checks the new password first, without counting an attempt', async () => {
    await expect(
      change.execute({ ...input, currentPassword: 'wrong', newPassword: 'short' }),
    ).rejects.toMatchObject({ refusal: { reason: 'password-too-short', minLength: 12 } });
    await expect(
      change.execute({ ...input, currentPassword: 'wrong', newPassword: 'motdepasse123' }),
    ).rejects.toMatchObject({ refusal: { reason: 'password-compromised' } });

    expect(accounts.state.lockouts.size).toBe(0);
  });

  it('counts a wrong current password with the failed sign-ins of the address', async () => {
    await expect(change.execute({ ...input, currentPassword: 'wrong' })).rejects.toMatchObject({
      refusal: { reason: 'password-incorrect', remainingAttempts: 4 },
    });

    expect(accounts.state.lockouts.get(camille.email.value)?.snapshot.failedAttempts).toBe(1);
    expect(accounts.state.credentials.get(camille.id)).toBe('hashed:atelier-nord-sprint-14');
    expect(accounts.state.events).toEqual([]);
  });

  it('clears the count of the failed passwords with the right current password', async () => {
    await expect(change.execute({ ...input, currentPassword: 'wrong' })).rejects.toBeDefined();

    await change.execute(input);

    expect(accounts.state.lockouts.has(camille.email.value)).toBe(false);
  });
});
