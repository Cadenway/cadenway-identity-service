import { beforeEach, describe, expect, it } from 'vitest';

import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import {
  FakeCodeSecrets,
  FakeDeviceReader,
  FakeSessionOpener,
  FixedClock,
  InMemoryAccounts,
} from '../../../../models/accounts/accounts.fixture.js';
import type { RecordedEvent } from '../../../../models/accounts/accounts.fixture.js';
import type { CodeVerificationInput } from '../../../../models/authentication/code-verification-input.model.js';
import {
  FakeChallengeTokens,
  FakeTrustedDevices,
  signedIn,
} from '../../../../models/two-step/two-step.fixture.js';
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
  let trustedDevices: FakeTrustedDevices;
  let challengeTokens: FakeChallengeTokens;
  let camille: User;

  const signInView = async (input: CodeVerificationInput): Promise<SessionIssuedView> =>
    signedIn(await signIn.execute(input));

  beforeEach(async () => {
    trustedDevices = new FakeTrustedDevices();
    challengeTokens = new FakeChallengeTokens();
    accounts = new InMemoryAccounts();
    clock = new FixedClock('2026-11-08T13:07:00Z');
    sessions = new FakeSessionOpener(accounts);
    const secrets: FakeCodeSecrets = new FakeCodeSecrets(['482913']);
    signIn = new SignInWithCode(
      accounts,
      secrets,
      sessions,
      clock,
      new FakeDeviceReader(),
      trustedDevices,
      challengeTokens,
    );
    camille = accounts.seedUser(CODE_SIGN_IN.email, true, 'hashed:x');
    await new RequestSignInCode(accounts, secrets, clock).execute({ email: CODE_SIGN_IN.email });
  });

  it('opens a session for the right code, once', async () => {
    const issued: SessionIssuedView = await signInView(CODE_SIGN_IN);

    expect(issued.user.id).toBe(camille.id);
    expect(sessions.opened).toEqual([
      {
        request: {
          userId: camille.id,
          persistent: true,
          client: CODE_SIGN_IN.client,
          authentication: 'password',
          newDeviceNotice: {
            email: 'camille.martin@ateliernord.fr',
            name: 'Camille Martin',
            language: 'fr',
            timeZone: 'Europe/Paris',
          },
        },
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

  it('cancels a scheduled deletion of the account it signs in, with the next version', async () => {
    const deleting: User = accounts.seedUser(
      'lea.petit@ateliernord.fr',
      true,
      'hashed:x',
      new Date('2026-12-09T15:30:00Z'),
    );
    const secrets: FakeCodeSecrets = new FakeCodeSecrets(['731406']);
    signIn = new SignInWithCode(
      accounts,
      secrets,
      sessions,
      clock,
      new FakeDeviceReader(),
      trustedDevices,
      challengeTokens,
    );
    clock.advance(30_000);
    await new RequestSignInCode(accounts, secrets, clock).execute({
      email: 'lea.petit@ateliernord.fr',
    });
    const issued: SessionIssuedView = await signInView({
      ...CODE_SIGN_IN,
      email: 'lea.petit@ateliernord.fr',
      code: '731406',
    });

    expect(issued.deletionCancelled).toBe(true);
    expect(issued.user.version).toBe(deleting.version + 1);
    const user: User | undefined = accounts.state.users.get(deleting.id);
    expect(user?.deleteAt).toBeNull();
    expect(user?.version).toBe(deleting.version + 1);
    expect(accounts.state.events.at(-1)).toMatchObject({
      name: 'user.deletion-cancelled.v1',
      sessionId: issued.session.id,
      client: { device: { type: 'unknown' }, ipAddress: '86.247.12.30' },
    });
  });

  it('cancels nothing for an account without a scheduled deletion', async () => {
    const issued: SessionIssuedView = await signInView(CODE_SIGN_IN);

    expect(issued.deletionCancelled).toBe(false);
    expect(issued.user.version).toBe(camille.version);
    expect(
      accounts.state.events.filter(
        (event: RecordedEvent) => event.name === 'user.deletion-cancelled.v1',
      ),
    ).toEqual([]);
  });
});
