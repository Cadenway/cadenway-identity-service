import { describe, expect, it, vi } from 'vitest';

import { SignInChallenge } from '../../../domain/aggregates/two-step/sign-in-challenge.aggregate.js';
import type { FederatedChallengeBinding } from '../../../domain/value-objects/federated-sign-in/federated-challenge-binding.value-object.js';
import { InMemoryAccounts } from '../../models/accounts/accounts.fixture.js';
import { FakeChallengeTokens, seedTwoStep } from '../../models/two-step/two-step.fixture.js';
import { lockChallenge } from './challenge-answers.service.js';

const binding: FederatedChallengeBinding = {
  linkId: '01938f6e-0000-7000-8000-000000000079',
  connection: {
    provider: 'saml',
    issuer: 'https://idp.example.test',
    organizationId: '01938f6e-0000-7000-8000-000000000071',
    connectionId: 'directory',
  },
};

async function fixture(federation: FederatedChallengeBinding | null, verified = true) {
  const accounts = new InMemoryAccounts();
  const user = accounts.seedUser('camille@example.test', verified, 'hashed:password');
  const now = new Date('2026-11-21T12:00:00Z');
  seedTwoStep(accounts, user.id, now);
  const tokens = new FakeChallengeTokens();
  const { token, tokenHash } = tokens.issue();
  await accounts.run((store) =>
    store.challenges.replace(SignInChallenge.issue(user.id, tokenHash, true, now, federation)),
  );
  const permission = vi.fn(() => Promise.resolve(true));
  const lock = () =>
    accounts.run((store) =>
      lockChallenge({ ...store, mayFinishFederatedChallenge: permission }, tokens, token, now),
    );
  return { accounts, user, lock, permission };
}

describe('federated two-step challenge authority', () => {
  it('uses the current locked authority and preserves the challenge while it is allowed', async () => {
    const { user, lock, permission, accounts } = await fixture(binding);
    await expect(lock()).resolves.toMatchObject({ user, challenge: { userId: user.id } });
    expect(permission).toHaveBeenCalledWith(user.id, binding);
    expect(accounts.state.challenges.get(user.id)?.federatedBinding).toEqual(binding);
  });

  it('expires a refused challenge before a factor or attempt can be consumed', async () => {
    const { user, lock, permission, accounts } = await fixture(binding);
    permission.mockResolvedValueOnce(false);
    await expect(lock()).resolves.toEqual({ reason: 'challenge-expired' });
    expect(accounts.state.challenges.has(user.id)).toBe(false);
    await expect(lock()).resolves.toEqual({ reason: 'challenge-expired' });
    expect(permission).toHaveBeenCalledTimes(1);
  });

  it('expires a federated challenge when the account is no longer verified', async () => {
    const { lock, permission } = await fixture(binding, false);
    await expect(lock()).resolves.toEqual({ reason: 'challenge-expired' });
    expect(permission).not.toHaveBeenCalled();
  });

  it('keeps existing password challenges independent of the federation authority', async () => {
    const { user, lock, permission } = await fixture(null);
    permission.mockResolvedValueOnce(false);
    await expect(lock()).resolves.toMatchObject({ user, challenge: { userId: user.id } });
    expect(permission).not.toHaveBeenCalled();
  });
});
