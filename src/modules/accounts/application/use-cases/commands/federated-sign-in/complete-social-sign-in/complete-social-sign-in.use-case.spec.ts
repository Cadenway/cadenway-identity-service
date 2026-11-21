import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import type { FederatedSignInFlow } from '../../../../../domain/aggregates/federated-sign-in/federated-sign-in-flow.aggregate.js';
import { SocialSignInProviderError } from '../../../../../domain/errors/federated-sign-in/social-sign-in-provider.error.js';
import type { SocialFlowCredentials } from '../../../../ports/outbound/security/federation/social-flow-credentials.port.js';
import type { SocialFlowStore } from '../../../../ports/outbound/transactions/federation/social-flow-store.port.js';
import type { SocialFlowUnitOfWork } from '../../../../ports/outbound/transactions/federation/social-flow-unit-of-work.port.js';
import { StartSocialSignIn } from '../start-social-sign-in/start-social-sign-in.use-case.js';
import { CompleteSocialSignIn } from './complete-social-sign-in.use-case.js';

function fixture() {
  let flow: FederatedSignInFlow | null = null;
  let version = 0;
  let tail: Promise<void> = Promise.resolve();
  let completedTransactions = 0;
  const connection = { provider: 'google' as const, issuer: 'https://issuer.example' };
  const credentials: SocialFlowCredentials = {
    issue: () => ({ id: 'flow-id', state: 'opaque-state', browserBinding: 'opaque-browser' }),
    receipt: () => 'opaque-receipt',
    digest: (value) => createHash('sha256').update(value).digest('hex'),
    providerSecrets: () => ({
      pkceVerifier: 'verifier',
      pkceChallenge: 'challenge',
      nonce: 'nonce',
    }),
  };
  const link = {
    id: 'link-id',
    userId: 'user-id',
    identity: { ...connection, subject: 'subject' },
    status: 'active' as const,
  };
  const isEligible = vi.fn(() => Promise.resolve(true));
  const findLink = vi.fn((): Promise<typeof link | null> => Promise.resolve(link));
  const store: SocialFlowStore = {
    insert: (next) => {
      flow = next;
      version = 1;
      return Promise.resolve();
    },
    findByStateHash: (hash) =>
      Promise.resolve(flow !== null && flow.snapshot.stateHash === hash ? { flow, version } : null),
    save: (next, expected) => {
      if (version !== expected) return Promise.resolve(false);
      flow = next;
      version += 1;
      return Promise.resolve(true);
    },
    findLink,
    isEligible,
  };
  const work: SocialFlowUnitOfWork = {
    run: async (operation) => {
      const previous = tail;
      let release: () => void = () => {
        throw new Error('The transaction lock was not initialized.');
      };
      tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await operation(store);
      } finally {
        completedTransactions += 1;
        release();
      }
    },
  };
  const verify = vi.fn(() => {
    expect(completedTransactions).toBeGreaterThanOrEqual(2);
    return Promise.resolve({ connection, subject: 'subject' });
  });
  const provider = {
    connection,
    authorizationUrl: () => new URL('https://issuer.example/authorize'),
    verify,
  };
  const providers = { find: () => provider };
  const clock = { now: () => new Date('2026-11-21T12:00:00Z') };
  const start = new StartSocialSignIn(providers, credentials, clock, work);
  const complete = new CompleteSocialSignIn(providers, credentials, clock, work);
  const callback = {
    provider: 'google' as const,
    state: 'opaque-state',
    browserBinding: 'opaque-browser',
    response: { outcome: 'authorized' as const, code: 'provider-code' },
  };
  return { start, complete, callback, verify, isEligible, findLink, current: () => flow };
}

describe('social sign-in flow', () => {
  it('stores only digests, claims before provider I/O and issues exactly one receipt under concurrency', async () => {
    const f = fixture();
    const started = await f.start.execute({ provider: 'google', rememberMe: true });
    expect(started.kind).toBe('started');
    expect(JSON.stringify(f.current()?.snapshot)).not.toContain('opaque-state');
    expect(JSON.stringify(f.current()?.snapshot)).not.toContain('opaque-browser');
    const results = await Promise.all([
      f.complete.execute(f.callback),
      f.complete.execute(f.callback),
    ]);
    expect(results.filter((result) => result.kind === 'issued')).toHaveLength(1);
    expect(results.filter((result) => result.kind === 'refused')).toHaveLength(1);
    expect(f.verify).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(f.current()?.snapshot)).not.toContain('opaque-receipt');
  });

  it('keeps a denied callback consumed and refuses a later retry', async () => {
    const f = fixture();
    await f.start.execute({ provider: 'google', rememberMe: false });
    await expect(
      f.complete.execute({
        ...f.callback,
        response: { outcome: 'denied', error: 'access_denied' },
      }),
    ).resolves.toEqual({ kind: 'refused' });
    await expect(f.complete.execute(f.callback)).resolves.toEqual({ kind: 'refused' });
    expect(f.verify).not.toHaveBeenCalled();
  });

  it('does not consume a valid flow when another browser presents it', async () => {
    const f = fixture();
    await f.start.execute({ provider: 'google', rememberMe: false });
    await expect(
      f.complete.execute({ ...f.callback, browserBinding: 'other-browser' }),
    ).resolves.toEqual({ kind: 'refused' });
    await expect(f.complete.execute(f.callback)).resolves.toMatchObject({ kind: 'issued' });
  });

  it('keeps a provider failure opaque and consumes the claimed state', async () => {
    const f = fixture();
    f.verify.mockRejectedValueOnce(new SocialSignInProviderError('unavailable'));
    await f.start.execute({ provider: 'google', rememberMe: false });
    await expect(f.complete.execute(f.callback)).resolves.toEqual({ kind: 'unavailable' });
    await expect(f.complete.execute(f.callback)).resolves.toEqual({ kind: 'refused' });
  });

  it('refuses a disabled account without issuing a continuation', async () => {
    const f = fixture();
    f.isEligible.mockResolvedValue(false);
    await f.start.execute({ provider: 'google', rememberMe: false });
    await expect(f.complete.execute(f.callback)).resolves.toEqual({ kind: 'refused' });
  });

  it('refuses an unlinked subject without matching by email', async () => {
    const f = fixture();
    f.findLink.mockResolvedValue(null);
    await f.start.execute({ provider: 'google', rememberMe: false });
    await expect(f.complete.execute(f.callback)).resolves.toEqual({ kind: 'refused' });
    expect(f.isEligible).not.toHaveBeenCalled();
  });

  it('does not consume a valid flow when a different provider presents it', async () => {
    const f = fixture();
    await f.start.execute({ provider: 'google', rememberMe: false });
    await expect(f.complete.execute({ ...f.callback, provider: 'github' })).resolves.toEqual({
      kind: 'refused',
    });
    await expect(f.complete.execute(f.callback)).resolves.toMatchObject({ kind: 'issued' });
  });
});
