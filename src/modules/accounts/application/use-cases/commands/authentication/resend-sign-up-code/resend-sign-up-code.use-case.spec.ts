import { beforeEach, describe, expect, it } from 'vitest';

import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import {
  FakeCodeSecrets,
  FixedClock,
  InMemoryAccounts,
} from '../../../../models/accounts/accounts.fixture.js';
import type { CodeSentView } from '../../../../projections/authentication/code-sent-view.projection.js';
import { ResendSignUpCode } from './resend-sign-up-code.use-case.js';

describe('ResendSignUpCode', () => {
  let accounts: InMemoryAccounts;
  let clock: FixedClock;
  let resend: ResendSignUpCode;

  beforeEach(() => {
    accounts = new InMemoryAccounts();
    clock = new FixedClock('2026-11-08T13:07:30Z');
    resend = new ResendSignUpCode(accounts, new FakeCodeSecrets(), clock);
  });

  it('issues a new code to an unverified account', async () => {
    const user: User = accounts.seedUser('camille.martin@ateliernord.fr', false, 'hashed:x');

    const sent: CodeSentView = await resend.execute({ email: 'camille.martin@ateliernord.fr' });

    expect(sent).toEqual({
      email: 'camille.martin@ateliernord.fr',
      expiresAt: new Date('2026-11-08T13:17:30Z'),
      resendAvailableAt: new Date('2026-11-08T13:08:00Z'),
    });
    expect(accounts.state.codes).toEqual([
      expect.objectContaining({ userId: user.id, purpose: 'email-verification' }),
    ]);
  });

  it('answers the same for an unknown or a verified address, and issues nothing', async () => {
    accounts.seedUser('camille.martin@ateliernord.fr', true, 'hashed:x');

    const unknown: CodeSentView = await resend.execute({ email: 'nobody@ateliernord.fr' });
    const verified: CodeSentView = await resend.execute({ email: 'camille.martin@ateliernord.fr' });

    expect(unknown.expiresAt).toEqual(verified.expiresAt);
    expect(accounts.state.codes).toEqual([]);
    expect(accounts.state.events).toEqual([]);
  });

  it('throttles the address within 30 seconds, account or not', async () => {
    await resend.execute({ email: 'nobody@ateliernord.fr' });
    clock.advance(10_000);

    await expect(resend.execute({ email: 'NOBODY@ateliernord.fr' })).rejects.toMatchObject({
      refusal: { reason: 'code-throttled', resendAvailableAt: new Date('2026-11-08T13:08:00Z') },
    });
    clock.advance(20_000);
    await expect(resend.execute({ email: 'nobody@ateliernord.fr' })).resolves.toBeDefined();
  });
});
