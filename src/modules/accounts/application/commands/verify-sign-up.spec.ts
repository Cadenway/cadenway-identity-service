import { beforeEach, describe, expect, it } from 'vitest';

import type { User } from '../../domain/user.js';
import {
  FakeCodeSecrets,
  FakeCompromisedPasswords,
  FakePasswordHasher,
  FakeSessionOpener,
  FixedClock,
  InMemoryAccounts,
} from '../accounts.fixture.js';
import type { RecordedEvent } from '../accounts.fixture.js';
import type { SessionIssuedView } from '../account-views.js';
import { ResendSignUpCode } from './resend-sign-up-code.js';
import { SignUp } from './sign-up.js';
import { VerifySignUp } from './verify-sign-up.js';
import type { VerifySignUpInput } from './verify-sign-up.js';

/**
 * Constant VERIFICATION
 *
 * @description
 * The code of the contract's example, typed on the Otp screen.
 *
 * @type {VerifySignUpInput}
 */
const VERIFICATION: VerifySignUpInput = {
  email: 'camille.martin@ateliernord.fr',
  code: '482913',
  rememberMe: false,
  client: { ipAddress: '86.247.12.30', userAgent: 'Mozilla/5.0 Firefox/145.0' },
};

describe('VerifySignUp', () => {
  let accounts: InMemoryAccounts;
  let clock: FixedClock;
  let sessions: FakeSessionOpener;
  let verify: VerifySignUp;
  let resend: ResendSignUpCode;

  beforeEach(async () => {
    accounts = new InMemoryAccounts();
    clock = new FixedClock('2026-11-08T13:07:00Z');
    sessions = new FakeSessionOpener(accounts);
    const secrets: FakeCodeSecrets = new FakeCodeSecrets(['482913', '771204']);
    verify = new VerifySignUp(accounts, secrets, sessions, clock);
    resend = new ResendSignUpCode(accounts, secrets, clock);
    await new SignUp(
      accounts,
      new FakePasswordHasher(),
      new FakeCompromisedPasswords(),
      secrets,
      clock,
    ).execute({
      name: 'Camille Martin',
      email: 'camille.martin@ateliernord.fr',
      password: 'atelier-nord-sprint-14',
      acceptTerms: true,
    });
  });

  it('verifies the address, opens the session inside the transaction and emits the verification', async () => {
    clock.advance(60_000);

    const issued: SessionIssuedView = await verify.execute(VERIFICATION);

    const user: User | undefined = accounts.userByEmail(VERIFICATION.email);
    expect(user?.isVerified).toBe(true);
    expect(user?.version).toBe(2);
    expect(issued.user).toEqual({
      id: user?.id,
      name: 'Camille Martin',
      email: 'camille.martin@ateliernord.fr',
      language: 'fr',
      version: 2,
    });
    expect(issued.session.token).toBe('token-1');
    expect(sessions.opened).toEqual([
      {
        request: { userId: user?.id, persistent: false, client: VERIFICATION.client },
        inTransaction: true,
      },
    ]);
    expect(accounts.state.events.at(-1)).toMatchObject({ name: 'user.email-verified.v1' });
  });

  it('refuses a wrong code, and keeps the attempt counted', async () => {
    await expect(verify.execute({ ...VERIFICATION, code: '000000' })).rejects.toMatchObject({
      refusal: { reason: 'code-invalid' },
    });

    expect(accounts.state.codes[0]?.failedAttempts).toBe(1);
    expect(accounts.userByEmail(VERIFICATION.email)?.isVerified).toBe(false);
    expect(sessions.opened).toEqual([]);
  });

  it('refuses the right code after five wrong ones', async () => {
    for (let attempt: number = 0; attempt < 5; attempt += 1) {
      await expect(verify.execute({ ...VERIFICATION, code: '000000' })).rejects.toMatchObject({
        refusal: { reason: 'code-invalid' },
      });
    }

    await expect(verify.execute(VERIFICATION)).rejects.toMatchObject({
      refusal: { reason: 'code-expired' },
    });
  });

  it('refuses the code after 10 minutes', async () => {
    clock.advance(10 * 60_000);

    await expect(verify.execute(VERIFICATION)).rejects.toMatchObject({
      refusal: { reason: 'code-expired' },
    });
  });

  it('refuses the code of an older email once a new one was sent', async () => {
    clock.advance(30_000);
    await resend.execute({ email: VERIFICATION.email });

    await expect(verify.execute(VERIFICATION)).rejects.toMatchObject({
      refusal: { reason: 'code-expired' },
    });
    await expect(verify.execute({ ...VERIFICATION, code: '771204' })).resolves.toBeDefined();
  });

  it('answers like a wrong code for an unknown address and once verified', async () => {
    await expect(
      verify.execute({ ...VERIFICATION, email: 'nobody@ateliernord.fr' }),
    ).rejects.toMatchObject({ refusal: { reason: 'code-invalid' } });

    await verify.execute(VERIFICATION);
    await expect(verify.execute(VERIFICATION)).rejects.toMatchObject({
      refusal: { reason: 'code-invalid' },
    });
    expect(
      accounts.state.events.filter(
        (event: RecordedEvent) => event.name === 'user.email-verified.v1',
      ),
    ).toHaveLength(1);
  });
});
