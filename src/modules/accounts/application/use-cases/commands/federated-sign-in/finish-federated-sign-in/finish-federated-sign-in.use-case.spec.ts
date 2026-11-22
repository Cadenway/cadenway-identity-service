import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { FederatedSignInFlow } from '../../../../../domain/aggregates/federated-sign-in/federated-sign-in-flow.aggregate.js';
import {
  FakeDeviceReader,
  FakeSessionOpener,
  FixedClock,
  InMemoryAccounts,
} from '../../../../models/accounts/accounts.fixture.js';
import {
  FakeChallengeTokens,
  FakeTrustedDevices,
  seedTwoStep,
} from '../../../../models/two-step/two-step.fixture.js';
import type { SocialFlowCredentials } from '../../../../ports/outbound/security/federation/social-flow-credentials.port.js';
import type { FederatedFinishUnitOfWork } from '../../../../ports/outbound/transactions/federation/federated-finish-unit-of-work.port.js';
import { FinishFederatedSignIn } from './finish-federated-sign-in.use-case.js';
import { FederatedFinishRefusal } from '../../../../models/authentication/federated-finish-refusal.model.js';

function fixture(saml = false) {
  const accounts = new InMemoryAccounts();
  const user = accounts.seedUser('camille.martin@ateliernord.fr', true, 'hashed:x');
  const sessions = new FakeSessionOpener(accounts);
  const clock = new FixedClock('2026-11-21T12:00:00Z');
  const digest = (value: string): string => createHash('sha256').update(value).digest('hex');
  const credentials: SocialFlowCredentials = {
    issue: () => ({ state: 'state', browserBinding: 'browser' }),
    receipt: () => 'receipt',
    digest,
    providerSecrets: () => ({
      pkceVerifier: 'verifier',
      pkceChallenge: 'challenge',
      nonce: 'nonce',
    }),
  };
  const connection = saml
    ? {
        provider: 'saml' as const,
        issuer: 'https://issuer.example',
        organizationId: '01938f6e-0000-7000-8000-000000000071',
        connectionId: 'directory',
      }
    : { provider: 'google' as const, issuer: 'https://issuer.example' };
  const identity = { ...connection, subject: 'subject' };
  const link = { id: 'link', userId: user.id, identity, status: 'active' as const };
  let flow = FederatedSignInFlow.issue(
    {
      id: 'flow',
      connection,
      stateHash: digest('state'),
      browserBindingHash: digest('browser'),
      persistent: true,
    },
    clock.now(),
  )
    .claim(
      {
        provider: connection.provider,
        stateHash: digest('state'),
        browserBindingHash: digest('browser'),
      },
      clock.now(),
    )
    .complete(
      { connection, subject: 'subject' },
      link,
      digest('receipt'),
      clock.now(),
      saml ? 'member' : undefined,
    );
  const findLink = vi.fn(() => Promise.resolve<typeof link | null>(link));
  const isAllowed = vi.fn(() => Promise.resolve(true));
  const findMembership = vi.fn(() =>
    Promise.resolve<{ organizationId: string; memberId: string } | null>(
      connection.provider === 'saml'
        ? { organizationId: connection.organizationId, memberId: 'member' }
        : null,
    ),
  );
  const work: FederatedFinishUnitOfWork = {
    run: (operation) =>
      accounts.run((store) =>
        operation({
          ...store,
          findByReceiptHash: (hash) =>
            Promise.resolve(hash === digest('receipt') ? { flow, version: 1 } : null),
          save: (next) => {
            flow = next;
            return Promise.resolve(true);
          },
          findLink,
          isAllowed,
          activeMembershipId: () => Promise.resolve('member'),
        }),
      ),
  };
  const finish = new FinishFederatedSignIn(
    work,
    credentials,
    clock,
    sessions,
    new FakeDeviceReader(),
    new FakeTrustedDevices(),
    new FakeChallengeTokens(),
    { find: findMembership },
  );
  const input = { receipt: 'receipt', client: { ipAddress: '86.247.12.30', userAgent: null } };
  return { finish, input, sessions, findLink, isAllowed, findMembership, clock, accounts, user };
}

describe('FinishFederatedSignIn', () => {
  it('consumes a receipt once and does not record password authentication', async () => {
    const f = fixture();
    await expect(f.finish.execute(f.input)).resolves.toMatchObject({ kind: 'signed-in' });
    expect(f.sessions.opened).toHaveLength(1);
    expect(f.sessions.opened[0]?.request.authentication).toBeNull();
    expect(f.sessions.opened[0]?.request.persistent).toBe(true);
    await expect(f.finish.execute(f.input)).rejects.toBeInstanceOf(FederatedFinishRefusal);
  });

  it('consumes the receipt if the linked identity was revoked', async () => {
    const f = fixture();
    f.findLink.mockResolvedValueOnce(null);
    await expect(f.finish.execute(f.input)).rejects.toBeInstanceOf(FederatedFinishRefusal);
    await expect(f.finish.execute(f.input)).rejects.toBeInstanceOf(FederatedFinishRefusal);
    expect(f.sessions.opened).toHaveLength(0);
  });

  it('refuses an expired receipt', async () => {
    const f = fixture();
    f.clock.advance(120_000);
    await expect(f.finish.execute(f.input)).rejects.toBeInstanceOf(FederatedFinishRefusal);
    expect(f.sessions.opened).toHaveLength(0);
  });

  it('consumes a receipt when the current sign-in policy refuses the account', async () => {
    const f = fixture();
    f.isAllowed.mockResolvedValueOnce(false);
    await expect(f.finish.execute(f.input)).rejects.toBeInstanceOf(FederatedFinishRefusal);
    await expect(f.finish.execute(f.input)).rejects.toBeInstanceOf(FederatedFinishRefusal);
    expect(f.sessions.opened).toHaveLength(0);
  });

  it('issues a challenge when the account has a second factor', async () => {
    const f = fixture();
    seedTwoStep(f.accounts, f.user.id, f.clock.now());
    await expect(f.finish.execute(f.input)).resolves.toMatchObject({ kind: 'challenge' });
    expect(f.accounts.state.challenges.get(f.user.id)?.federatedBinding).toEqual({
      linkId: 'link',
      connection: { provider: 'google', issuer: 'https://issuer.example' },
    });
    expect(f.sessions.opened).toHaveLength(0);
    await expect(f.finish.execute(f.input)).rejects.toBeInstanceOf(FederatedFinishRefusal);
  });

  it('refuses a SAML receipt when Organization confirms the member was removed', async () => {
    const f = fixture(true);
    f.findMembership.mockResolvedValueOnce(null);

    await expect(f.finish.execute(f.input)).rejects.toBeInstanceOf(FederatedFinishRefusal);
    expect(f.sessions.opened).toHaveLength(0);
  });

  it('does not issue a SAML session when the membership authority is unavailable', async () => {
    const f = fixture(true);
    f.findMembership.mockRejectedValueOnce(new Error('authority unavailable'));

    await expect(f.finish.execute(f.input)).rejects.toThrow('authority unavailable');
    expect(f.sessions.opened).toHaveLength(0);
  });

  it('retains the proven SAML membership in the issued session', async () => {
    const f = fixture(true);
    await expect(f.finish.execute(f.input)).resolves.toMatchObject({ kind: 'signed-in' });
    expect(f.sessions.opened[0]?.request.samlMembership).toEqual({
      organizationId: '01938f6e-0000-7000-8000-000000000071',
      memberId: 'member',
    });
  });

  it('refuses a SAML receipt when the original member was replaced', async () => {
    const f = fixture(true);
    f.findMembership.mockResolvedValueOnce({
      organizationId: '01938f6e-0000-7000-8000-000000000071',
      memberId: 'new-member',
    });
    await expect(f.finish.execute(f.input)).rejects.toBeInstanceOf(FederatedFinishRefusal);
    expect(f.sessions.opened).toHaveLength(0);
  });

  it('binds a SAML second-factor challenge to the original member', async () => {
    const f = fixture(true);
    seedTwoStep(f.accounts, f.user.id, f.clock.now());

    await expect(f.finish.execute(f.input)).resolves.toMatchObject({ kind: 'challenge' });
    expect(f.accounts.state.challenges.get(f.user.id)?.federatedBinding).toMatchObject({
      memberId: 'member',
    });
  });
});
