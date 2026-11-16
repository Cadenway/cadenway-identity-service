import { beforeEach, describe, expect, it } from 'vitest';

import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import {
  FakeCodeSecrets,
  FakeSessionOpener,
  FixedClock,
  InMemoryAccounts,
} from '../../../../models/accounts/accounts.fixture.js';
import type { CodeVerificationInput } from '../../../../models/authentication/code-verification-input.model.js';
import type { SessionIssuedView } from '../../../../projections/authentication/session-issued-view.projection.js';
import { RequestSignInCode } from '../request-sign-in-code/request-sign-in-code.use-case.js';
import { SignInWithCode } from './sign-in-with-code.use-case.js';

/**
 * Constant CODE_SIGN_IN
 *
 * @description
 * A sign-in code typed on the Otp screen.
 *
 * @type {CodeVerificationInput}
 */
const CODE_SIGN_IN: CodeVerificationInput = {
  email: 'camille.martin@ateliernord.fr',
  code: '482913',
  rememberMe: true,
  client: { ipAddress: '86.247.12.30', userAgent: null },
};

describe('SignInWithCode', () => {
  let accounts: InMemoryAccounts;
  let clock: FixedClock;
  let sessions: FakeSessionOpener;
  let signIn: SignInWithCode;
  let camille: User;

  beforeEach(async () => {
    accounts = new InMemoryAccounts();
    clock = new FixedClock('2026-11-08T13:07:00Z');
    sessions = new FakeSessionOpener(accounts);
    const secrets: FakeCodeSecrets = new FakeCodeSecrets(['482913']);
    signIn = new SignInWithCode(accounts, secrets, sessions, clock);
    camille = accounts.seedUser(CODE_SIGN_IN.email, true, 'hashed:x');
    await new RequestSignInCode(accounts, secrets, clock).execute({ email: CODE_SIGN_IN.email });
  });

  it('opens a session for the right code, once', async () => {
    const issued: SessionIssuedView = await signIn.execute(CODE_SIGN_IN);

    expect(issued.user.id).toBe(camille.id);
    expect(sessions.opened).toEqual([
      {
        request: { userId: camille.id, persistent: true, client: CODE_SIGN_IN.client },
        inTransaction: true,
      },
    ]);
    await expect(signIn.execute(CODE_SIGN_IN)).rejects.toMatchObject({
      refusal: { reason: 'code-expired' },
    });
  });

  it('refuses a wrong code and an address without a verified account', async () => {
    accounts.seedUser('pending@ateliernord.fr', false, 'hashed:x');

    await expect(signIn.execute({ ...CODE_SIGN_IN, code: '000000' })).rejects.toMatchObject({
      refusal: { reason: 'code-invalid' },
    });
    await expect(
      signIn.execute({ ...CODE_SIGN_IN, email: 'pending@ateliernord.fr' }),
    ).rejects.toMatchObject({ refusal: { reason: 'code-invalid' } });
    await expect(
      signIn.execute({ ...CODE_SIGN_IN, email: 'nobody@ateliernord.fr' }),
    ).rejects.toMatchObject({ refusal: { reason: 'code-invalid' } });
  });

  it('refuses the code after 10 minutes', async () => {
    clock.advance(10 * 60_000);

    await expect(signIn.execute(CODE_SIGN_IN)).rejects.toMatchObject({
      refusal: { reason: 'code-expired' },
    });
  });
});
