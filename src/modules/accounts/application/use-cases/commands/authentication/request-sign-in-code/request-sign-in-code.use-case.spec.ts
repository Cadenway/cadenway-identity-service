import { beforeEach, describe, expect, it } from 'vitest';

import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import {
  FakeCodeSecrets,
  FixedClock,
  InMemoryAccounts,
} from '../../../../models/accounts/accounts.fixture.js';
import { ResendSignUpCode } from '../resend-sign-up-code/resend-sign-up-code.use-case.js';
import { RequestSignInCode } from './request-sign-in-code.use-case.js';

describe('RequestSignInCode', () => {
  let accounts: InMemoryAccounts;
  let clock: FixedClock;
  let request: RequestSignInCode;

  beforeEach(() => {
    accounts = new InMemoryAccounts();
    clock = new FixedClock('2026-11-08T13:07:00Z');
    request = new RequestSignInCode(accounts, new FakeCodeSecrets(), clock);
  });

  it('issues a sign-in code to a verified account, replacing the previous one', async () => {
    const user: User = accounts.seedUser('camille.martin@ateliernord.fr', true, 'hashed:x');

    await request.execute({ email: 'camille.martin@ateliernord.fr' });
    clock.advance(30_000);
    await request.execute({ email: 'camille.martin@ateliernord.fr' });

    expect(accounts.state.codes).toEqual([
      expect.objectContaining({
        userId: user.id,
        purpose: 'sign-in',
        replacedAt: expect.any(Date) as unknown,
      }),
      expect.objectContaining({ userId: user.id, purpose: 'sign-in', replacedAt: null }),
    ]);
    expect(accounts.state.events).toHaveLength(2);
  });

  it('issues nothing to an unverified account or an unknown address, answering the same', async () => {
    accounts.seedUser('camille.martin@ateliernord.fr', false, 'hashed:x');

    await expect(
      request.execute({ email: 'camille.martin@ateliernord.fr' }),
    ).resolves.toMatchObject({
      email: 'camille.martin@ateliernord.fr',
    });
    await expect(request.execute({ email: 'nobody@ateliernord.fr' })).resolves.toMatchObject({
      email: 'nobody@ateliernord.fr',
    });
    expect(accounts.state.codes).toEqual([]);
  });

  it('throttles the address within 30 seconds', async () => {
    await request.execute({ email: 'nobody@ateliernord.fr' });

    await expect(request.execute({ email: 'nobody@ateliernord.fr' })).rejects.toMatchObject({
      refusal: { reason: 'code-throttled' },
    });
  });

  it('shares the throttle of the address with the sign-up codes', async () => {
    await new ResendSignUpCode(accounts, new FakeCodeSecrets(), clock).execute({
      email: 'camille.martin@ateliernord.fr',
    });

    await expect(request.execute({ email: 'camille.martin@ateliernord.fr' })).rejects.toMatchObject(
      { refusal: { reason: 'code-throttled' } },
    );
  });

  it('accepts 5 requests of an address in an hour, then refuses until the hour ends', async () => {
    accounts.seedUser('camille.martin@ateliernord.fr', true, 'hashed:x');
    for (let request_: number = 0; request_ < 5; request_ += 1) {
      await request.execute({ email: 'camille.martin@ateliernord.fr' });
      clock.advance(30_000);
    }

    await expect(request.execute({ email: 'camille.martin@ateliernord.fr' })).rejects.toMatchObject(
      {
        refusal: { reason: 'code-throttled', resendAvailableAt: new Date('2026-11-08T14:07:00Z') },
      },
    );
    expect(accounts.state.codes).toHaveLength(5);
    clock.advance(60 * 60_000);
    await expect(
      request.execute({ email: 'camille.martin@ateliernord.fr' }),
    ).resolves.toBeDefined();
  });
});
