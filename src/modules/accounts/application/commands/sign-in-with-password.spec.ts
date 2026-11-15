import { beforeEach, describe, expect, it } from 'vitest';

import type { User } from '../../domain/user.js';
import {
  FakePasswordHasher,
  FakeSessionOpener,
  FixedClock,
  InMemoryAccounts,
} from '../accounts.fixture.js';
import type { SessionIssuedView } from '../account-views.js';
import { SignInWithPassword } from './sign-in-with-password.js';
import type { PasswordSignInInput } from './sign-in-with-password.js';

/**
 * Constant SIGN_IN
 *
 * @description
 * The sign-in of the Main screen, as the contract's example.
 *
 * @type {PasswordSignInInput}
 */
const SIGN_IN: PasswordSignInInput = {
  email: 'camille.martin@ateliernord.fr',
  password: 'atelier-nord-sprint-14',
  rememberMe: true,
  client: { ipAddress: '86.247.12.30', userAgent: null },
};

describe('SignInWithPassword', () => {
  let accounts: InMemoryAccounts;
  let clock: FixedClock;
  let hasher: FakePasswordHasher;
  let sessions: FakeSessionOpener;
  let signIn: SignInWithPassword;
  let camille: User;

  beforeEach(() => {
    accounts = new InMemoryAccounts();
    clock = new FixedClock('2026-11-08T13:07:00Z');
    hasher = new FakePasswordHasher();
    sessions = new FakeSessionOpener(accounts);
    signIn = new SignInWithPassword(accounts, hasher, sessions, clock);
    camille = accounts.seedUser(SIGN_IN.email, true, 'hashed:atelier-nord-sprint-14');
  });

  it('opens a persistent session for the right password, inside the transaction', async () => {
    const issued: SessionIssuedView = await signIn.execute({
      ...SIGN_IN,
      email: 'Camille.Martin@AtelierNord.fr',
    });

    expect(issued.user.id).toBe(camille.id);
    expect(issued.session.persistent).toBe(true);
    expect(sessions.opened).toEqual([
      {
        request: { userId: camille.id, persistent: true, client: SIGN_IN.client },
        inTransaction: true,
      },
    ]);
  });

  it('counts down the attempts, then locks for 15 minutes even the right password', async () => {
    const remaining: unknown[] = [];
    for (let attempt: number = 0; attempt < 4; attempt += 1) {
      try {
        await signIn.execute({ ...SIGN_IN, password: 'not-the-password' });
      } catch (error) {
        remaining.push(error);
      }
    }
    expect(remaining).toMatchObject(
      [4, 3, 2, 1].map((left: number) => ({
        refusal: { reason: 'invalid-credentials', remainingAttempts: left },
      })),
    );

    await expect(
      signIn.execute({ ...SIGN_IN, password: 'not-the-password' }),
    ).rejects.toMatchObject({
      refusal: { reason: 'account-locked', lockedUntil: new Date('2026-11-08T13:22:00Z') },
    });
    clock.advance(14 * 60_000);
    await expect(signIn.execute(SIGN_IN)).rejects.toMatchObject({
      refusal: { reason: 'account-locked', lockedUntil: new Date('2026-11-08T13:22:00Z') },
    });
    expect(sessions.opened).toEqual([]);

    clock.advance(60_000);
    await expect(signIn.execute(SIGN_IN)).resolves.toBeDefined();
  });

  it('counts the failures of an address without an account, checking a decoy hash', async () => {
    await expect(
      signIn.execute({ ...SIGN_IN, email: 'nobody@ateliernord.fr' }),
    ).rejects.toMatchObject({ refusal: { reason: 'invalid-credentials', remainingAttempts: 4 } });

    expect(hasher.decoyChecks).toBe(1);
    expect(accounts.state.lockouts.get('nobody@ateliernord.fr')?.snapshot.failedAttempts).toBe(1);
  });

  it('resets the count after a success', async () => {
    await expect(signIn.execute({ ...SIGN_IN, password: 'wrong' })).rejects.toBeDefined();
    await signIn.execute(SIGN_IN);

    expect(accounts.state.lockouts.size).toBe(0);
    await expect(signIn.execute({ ...SIGN_IN, password: 'wrong' })).rejects.toMatchObject({
      refusal: { remainingAttempts: 4 },
    });
  });

  it('refuses the right password of an unverified account, without opening a session', async () => {
    accounts.seedUser('pending@ateliernord.fr', false, 'hashed:atelier-nord-sprint-14');

    await expect(
      signIn.execute({ ...SIGN_IN, email: 'pending@ateliernord.fr' }),
    ).rejects.toMatchObject({ refusal: { reason: 'email-not-verified' } });
    expect(sessions.opened).toEqual([]);
  });
});
