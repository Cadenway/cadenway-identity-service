import { beforeEach, describe, expect, it } from 'vitest';

import type { User } from '../../domain/user.js';
import {
  FakeCodeSecrets,
  FakeCompromisedPasswords,
  FakePasswordHasher,
  FixedClock,
  InMemoryAccounts,
} from '../accounts.fixture.js';
import type { RecordedEvent } from '../accounts.fixture.js';
import type { CodeSentView } from '../account-views.js';
import { SignUp } from './sign-up.js';
import type { SignUpInput } from './sign-up.js';

/**
 * Constant SIGN_UP
 *
 * @description
 * The sign-up of the Inscription screen, as the contract's example.
 *
 * @type {SignUpInput}
 */
const SIGN_UP: SignUpInput = {
  name: 'Camille Martin',
  email: 'camille.martin@ateliernord.fr',
  password: 'atelier-nord-sprint-14',
  acceptTerms: true,
};

describe('SignUp', () => {
  let accounts: InMemoryAccounts;
  let clock: FixedClock;
  let signUp: SignUp;

  beforeEach(() => {
    accounts = new InMemoryAccounts();
    clock = new FixedClock('2026-11-08T13:07:00Z');
    signUp = new SignUp(
      accounts,
      new FakePasswordHasher(),
      new FakeCompromisedPasswords(['password1234']),
      new FakeCodeSecrets(['482913', '771204']),
      clock,
    );
  });

  it('creates an unverified account, stores the password hash and issues a 10-minute code', async () => {
    const sent: CodeSentView = await signUp.execute({
      ...SIGN_UP,
      email: 'Camille.Martin@AtelierNord.fr',
    });

    expect(sent).toEqual({
      email: 'camille.martin@ateliernord.fr',
      expiresAt: new Date('2026-11-08T13:17:00Z'),
      resendAvailableAt: new Date('2026-11-08T13:07:30Z'),
    });
    const user: User | undefined = accounts.userByEmail(SIGN_UP.email);
    expect(user?.isVerified).toBe(false);
    expect(user?.version).toBe(1);
    expect(accounts.state.credentials.get(user?.id ?? '')).toBe('hashed:atelier-nord-sprint-14');
    expect(accounts.state.codes).toEqual([
      expect.objectContaining({
        userId: user?.id,
        purpose: 'email-verification',
        codeHash: `${user?.id ?? ''}:email-verification:482913`,
      }),
    ]);
    expect(accounts.state.events.map((event: RecordedEvent) => event.name)).toEqual([
      'user.signed-up.v1',
      'one-time-code.issued.v1',
    ]);
    expect(accounts.state.events[1]).toMatchObject({
      issued: { code: '482913', purpose: 'email-verification', user: { id: user?.id } },
    });
  });

  it('refuses, in order, the terms, a short password and a compromised one, writing nothing', async () => {
    await expect(
      signUp.execute({ ...SIGN_UP, acceptTerms: false, password: 'court' }),
    ).rejects.toMatchObject({
      refusal: { reason: 'terms-not-accepted' },
    });
    await expect(signUp.execute({ ...SIGN_UP, password: 'atelier-nor' })).rejects.toMatchObject({
      refusal: { reason: 'password-too-short', minLength: 12 },
    });
    await expect(signUp.execute({ ...SIGN_UP, password: 'password1234' })).rejects.toMatchObject({
      refusal: { reason: 'password-compromised' },
    });
    expect(accounts.state.users.size).toBe(0);
    expect(accounts.state.events).toEqual([]);
  });

  it('refuses an address a verified account uses, writing nothing', async () => {
    accounts.seedUser(SIGN_UP.email, true, 'hashed:other');

    await expect(signUp.execute(SIGN_UP)).rejects.toMatchObject({
      refusal: { reason: 'email-taken' },
    });
    expect(accounts.state.events).toEqual([]);
    expect(accounts.state.codes).toEqual([]);
  });

  it('throttles a new sign-up of the address for 30 seconds, writing nothing', async () => {
    await signUp.execute(SIGN_UP);
    clock.advance(29_000);

    await expect(signUp.execute(SIGN_UP)).rejects.toMatchObject({
      refusal: { reason: 'code-throttled', resendAvailableAt: new Date('2026-11-08T13:07:30Z') },
    });
    expect(accounts.state.events).toHaveLength(2);
  });

  it('signs an unverified address up again: same account, new name and password, next version, new code', async () => {
    await signUp.execute(SIGN_UP);
    const first: User | undefined = accounts.userByEmail(SIGN_UP.email);
    clock.advance(30_000);

    await signUp.execute({ ...SIGN_UP, name: 'Camille M.', password: 'atelier-nord-sprint-15' });

    const again: User | undefined = accounts.userByEmail(SIGN_UP.email);
    expect(again?.id).toBe(first?.id);
    expect(again?.name).toBe('Camille M.');
    expect(again?.version).toBe(2);
    expect(accounts.state.credentials.get(again?.id ?? '')).toBe('hashed:atelier-nord-sprint-15');
    expect(accounts.state.codes.map((code) => code.replacedAt !== null)).toEqual([true, false]);
    expect(
      accounts.state.events
        .filter((event: RecordedEvent) => event.name === 'user.signed-up.v1')
        .map((event: RecordedEvent) => ('user' in event ? event.user.version : 0)),
    ).toEqual([1, 2]);
  });
});
