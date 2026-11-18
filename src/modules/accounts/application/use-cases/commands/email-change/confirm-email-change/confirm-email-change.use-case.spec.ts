import { beforeEach, describe, expect, it } from 'vitest';

import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import type { OneTimeCodeState } from '../../../../../domain/aggregates/one-time-codes/one-time-code-state.aggregate.js';
import type { PasswordResetLinkState } from '../../../../../domain/aggregates/password-reset/password-reset-link-state.aggregate.js';
import { EmailAddress } from '../../../../../domain/value-objects/email/email-address.value-object.js';
import {
  FakeAccountSessions,
  FakeCodeSecrets,
  FakeDeviceReader,
  FixedClock,
  InMemoryAccounts,
} from '../../../../models/accounts/accounts.fixture.js';
import type { AccountView } from '../../../../projections/accounts/account-view.projection.js';
import { RequestEmailChange } from '../request-email-change/request-email-change.use-case.js';
import type { ConfirmEmailChangeInput } from './confirm-email-change.input.js';
import { ConfirmEmailChange } from './confirm-email-change.use-case.js';

/**
 * Constant SESSION_ID
 *
 * @description
 * The session that asks for the change.
 *
 * @type {string}
 */
const SESSION_ID: string = '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60';

/**
 * Constant OTHER_SESSION_ID
 *
 * @description
 * Another open session of Camille Martin.
 *
 * @type {string}
 */
const OTHER_SESSION_ID: string = '019a6914-2f7a-7b3c-9d4e-5f6a7b8c9d01';

describe('ConfirmEmailChange', () => {
  let accounts: InMemoryAccounts;
  let clock: FixedClock;
  let sessions: FakeAccountSessions;
  let confirm: ConfirmEmailChange;
  let camille: User;
  let input: ConfirmEmailChangeInput;

  beforeEach(async () => {
    accounts = new InMemoryAccounts();
    clock = new FixedClock('2026-11-09T13:20:00Z');
    sessions = new FakeAccountSessions(clock);
    const secrets: FakeCodeSecrets = new FakeCodeSecrets(['731406']);
    confirm = new ConfirmEmailChange(accounts, secrets, sessions, new FakeDeviceReader(), clock);
    camille = accounts.seedUser('camille.martin@ateliernord.fr', true, 'hashed:x');
    sessions.seed(SESSION_ID, camille.id, clock.now());
    sessions.seed(OTHER_SESSION_ID, camille.id, clock.now());
    await new RequestEmailChange(accounts, secrets, sessions, clock).execute({
      actorUserId: camille.id,
      userId: camille.id,
      sessionId: SESSION_ID,
      email: 'camille@ateliernord.fr',
    });
    clock.advance(4 * 60_000);
    input = {
      actorUserId: camille.id,
      userId: camille.id,
      sessionId: SESSION_ID,
      code: '731406',
      client: { ipAddress: '192.0.2.14', userAgent: 'Mozilla/5.0 Firefox/132.0' },
    };
  });

  it('makes the new address the verified address of the account, with the next version', async () => {
    const view: AccountView = await confirm.execute(input);

    expect(view).toMatchObject({ email: 'camille@ateliernord.fr', version: camille.version + 1 });
    const user: User | undefined = accounts.state.users.get(camille.id);
    expect(user?.isVerified).toBe(true);
    expect(accounts.state.emailChanges.has(camille.id)).toBe(false);
    expect(accounts.state.events.at(-1)).toMatchObject({
      name: 'user.email-changed.v1',
      previousEmail: 'camille.martin@ateliernord.fr',
      user: { email: { value: 'camille@ateliernord.fr' } },
      client: { ipAddress: '192.0.2.14', device: { browser: 'Firefox' } },
    });
    await expect(sessions.countOpen(camille.id)).resolves.toBe(2);
  });

  it('makes the codes and the reset link of the previous address stop working', async () => {
    accounts.state.codes.push({
      id: '019a5f3c-8d2e-7c4a-9b1f-000000000099',
      userId: camille.id,
      purpose: 'sign-in',
      codeHash: 'hash',
      expiresAt: new Date('2026-11-09T13:30:00Z'),
      failedAttempts: 0,
      consumedAt: null,
      replacedAt: null,
    });
    accounts.state.resetLinks.push({
      id: '019a5f3c-8d2e-7c4a-9b1f-000000000098',
      userId: camille.id,
      tokenHash: 'hash:reset-token-1',
      expiresAt: new Date('2026-11-09T13:50:00Z'),
      usedAt: null,
      replacedAt: null,
    });

    await confirm.execute(input);

    expect(
      accounts.state.codes.filter(
        (code: OneTimeCodeState) => code.consumedAt === null && code.replacedAt === null,
      ),
    ).toEqual([]);
    expect(
      accounts.state.resetLinks.filter(
        (link: PasswordResetLinkState) => link.usedAt === null && link.replacedAt === null,
      ),
    ).toEqual([]);
  });

  it('answers the code of another session, or without a pending change, as a wrong code', async () => {
    await expect(confirm.execute({ ...input, sessionId: OTHER_SESSION_ID })).rejects.toMatchObject({
      refusal: { reason: 'code-invalid' },
    });
    accounts.state.emailChanges.delete(camille.id);
    await expect(confirm.execute(input)).rejects.toMatchObject({
      refusal: { reason: 'code-invalid' },
    });
  });

  it('refuses the account of another person and a session that is not open', async () => {
    await expect(
      confirm.execute({ ...input, userId: '019a5f3c-8d2e-7c4a-9b1f-ffffffffffff' }),
    ).rejects.toMatchObject({ refusal: { reason: 'user-not-found' } });
    await expect(
      confirm.execute({ ...input, sessionId: '019a6a2e-4b1c-7d3e-8f5a-ffffffffffff' }),
    ).rejects.toMatchObject({ refusal: { reason: 'session-not-found' } });
  });

  it('counts a wrong code, and stops it after five', async () => {
    for (let attempt: number = 0; attempt < 5; attempt += 1) {
      await expect(confirm.execute({ ...input, code: '000000' })).rejects.toMatchObject({
        refusal: { reason: 'code-invalid' },
      });
    }

    expect(accounts.state.codes.at(-1)?.failedAttempts).toBe(5);
    await expect(confirm.execute(input)).rejects.toMatchObject({
      refusal: { reason: 'code-expired' },
    });
  });

  it('refuses an expired code', async () => {
    clock.advance(11 * 60_000);

    await expect(confirm.execute(input)).rejects.toMatchObject({
      refusal: { reason: 'code-expired' },
    });
  });

  it('drops the change when a verified account took the new address since the request', async () => {
    accounts.seedUser('camille@ateliernord.fr', true, 'hashed:x');

    await expect(confirm.execute(input)).rejects.toMatchObject({
      refusal: { reason: 'email-taken' },
    });
    expect(accounts.state.emailChanges.has(camille.id)).toBe(false);
    expect(accounts.state.users.get(camille.id)?.email.value).toBe('camille.martin@ateliernord.fr');
  });

  it('ends an unverified sign-up of the new address', async () => {
    const pending: User = accounts.seedUser('camille@ateliernord.fr', false, 'hashed:y');

    await confirm.execute(input);

    expect(accounts.state.users.has(pending.id)).toBe(false);
    expect(accounts.userByEmail('camille@ateliernord.fr')?.id).toBe(camille.id);
    expect(
      accounts.state.users.get(camille.id)?.email.equals(EmailAddress.of('camille@ateliernord.fr')),
    ).toBe(true);
  });
});
