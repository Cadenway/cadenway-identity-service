import { beforeEach, describe, expect, it } from 'vitest';

import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import {
  FakeAccountSessions,
  FakeDeviceReader,
  FakeResetLinkSecrets,
  FixedClock,
  InMemoryAccounts,
} from '../../../../models/accounts/accounts.fixture.js';
import { RequestPasswordReset } from '../../../commands/password-reset/request-password-reset/request-password-reset.use-case.js';
import { InspectPasswordResetLink } from './inspect-password-reset-link.use-case.js';

describe('InspectPasswordResetLink', () => {
  let accounts: InMemoryAccounts;
  let clock: FixedClock;
  let secrets: FakeResetLinkSecrets;
  let sessions: FakeAccountSessions;
  let inspect: InspectPasswordResetLink;
  let request: RequestPasswordReset;
  let camille: User;

  beforeEach(async () => {
    accounts = new InMemoryAccounts();
    clock = new FixedClock('2026-11-09T13:10:00Z');
    secrets = new FakeResetLinkSecrets();
    sessions = new FakeAccountSessions(clock);
    inspect = new InspectPasswordResetLink(accounts, secrets, sessions, clock);
    request = new RequestPasswordReset(accounts, secrets, new FakeDeviceReader(), clock);
    camille = accounts.seedUser('camille.martin@ateliernord.fr', true, 'hashed:x');
    sessions.seed('019a6a2e-4b1c-7d3e-8f5a-000000000001', camille.id, null);
    sessions.seed('019a6a2e-4b1c-7d3e-8f5a-000000000002', camille.id, null);
    sessions.seed('019a6a2e-4b1c-7d3e-8f5a-000000000003', camille.id, null);
    await request.execute({
      email: camille.email.value,
      client: { ipAddress: '192.0.2.14', userAgent: null },
    });
  });

  it('tells the account of a usable link, its expiry and its open sessions, without using it', async () => {
    const expected: object = {
      email: 'camille.martin@ateliernord.fr',
      expiresAt: new Date('2026-11-09T13:40:00Z'),
      sessionCount: 3,
    };

    await expect(inspect.execute({ token: 'reset-token-1' })).resolves.toEqual(expected);
    await expect(inspect.execute({ token: 'reset-token-1' })).resolves.toEqual(expected);
    expect(accounts.state.resetLinks[0]?.usedAt).toBeNull();
  });

  it('answers a malformed or an unknown token as an expired link', async () => {
    for (const token of ['not-a-token', 'reset-token-99']) {
      await expect(inspect.execute({ token })).rejects.toMatchObject({
        refusal: { reason: 'reset-link-expired' },
      });
    }
  });

  it('answers a link after its 30 minutes as expired', async () => {
    clock.advance(30 * 60_000);

    await expect(inspect.execute({ token: 'reset-token-1' })).rejects.toMatchObject({
      refusal: { reason: 'reset-link-expired' },
    });
  });

  it('answers a link a newer one replaced, and a used one, as expired', async () => {
    clock.advance(45_000);
    await request.execute({
      email: camille.email.value,
      client: { ipAddress: '192.0.2.14', userAgent: null },
    });
    await expect(inspect.execute({ token: 'reset-token-1' })).rejects.toMatchObject({
      refusal: { reason: 'reset-link-expired' },
    });

    const second = accounts.state.resetLinks[1];
    if (second === undefined) {
      throw new Error('The second link is missing.');
    }
    accounts.state.resetLinks[1] = { ...second, usedAt: clock.now() };
    await expect(inspect.execute({ token: 'reset-token-2' })).rejects.toMatchObject({
      refusal: { reason: 'reset-link-expired' },
    });
  });
});
