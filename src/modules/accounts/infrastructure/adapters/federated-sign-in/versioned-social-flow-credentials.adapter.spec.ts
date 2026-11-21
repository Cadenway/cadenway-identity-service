import { createHash, createSecretKey } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { VersionedSocialFlowCredentials } from './versioned-social-flow-credentials.adapter.js';

describe('VersionedSocialFlowCredentials', () => {
  const firstKey = createSecretKey(Buffer.alloc(32, 1));
  const nextKey = createSecretKey(Buffer.alloc(32, 2));
  const versions = new Map([
    ['k1', firstKey],
    ['k2', nextKey],
  ]);

  it('issues separate credentials that each carry 256 random bits', () => {
    const adapter = new VersionedSocialFlowCredentials('k1', versions);
    const issued = adapter.issue();
    const stateBytes = issued.state.slice('k1_'.length);
    const receipt = adapter.receipt();

    expect(issued.state).toMatch(/^k1_[A-Za-z0-9_-]{43}$/u);
    for (const credential of [stateBytes, issued.browserBinding, receipt]) {
      expect(credential).toMatch(/^[A-Za-z0-9_-]{43}$/u);
      expect(Buffer.from(credential, 'base64url')).toHaveLength(32);
    }
    expect(new Set([stateBytes, issued.browserBinding, receipt]).size).toBe(3);
    expect(adapter.issue()).not.toEqual(issued);
    expect(adapter.receipt()).not.toBe(receipt);
  });

  it('hashes all opaque browser credentials with SHA-256 in hex', () => {
    const adapter = new VersionedSocialFlowCredentials('k1', versions);
    const issued = adapter.issue();
    for (const credential of [issued.state, issued.browserBinding, adapter.receipt()]) {
      expect(adapter.digest(credential)).toBe(
        createHash('sha256').update(credential, 'utf8').digest('hex'),
      );
    }
  });

  it('reconstructs distinct PKCE and nonce values after rotation on another replica', () => {
    const original = new VersionedSocialFlowCredentials('k1', new Map([['k1', firstKey]]));
    const replacement = new VersionedSocialFlowCredentials('k2', versions);
    const issued = original.issue();
    const secrets = original.providerSecrets(issued.state);

    expect(replacement.providerSecrets(issued.state)).toEqual(secrets);
    expect(replacement.issue().state).toMatch(/^k2_/u);
    expect(secrets.pkceVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(secrets.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(secrets.nonce).not.toBe(secrets.pkceVerifier);
    expect(secrets.pkceChallenge).toBe(
      createHash('sha256').update(secrets.pkceVerifier, 'ascii').digest('base64url'),
    );
    expect(replacement.providerSecrets(replacement.issue().state)).not.toEqual(secrets);
  });

  it('refuses unavailable versions and malformed state without including the input', () => {
    const old = new VersionedSocialFlowCredentials('k1', versions);
    const activeOnly = new VersionedSocialFlowCredentials('k2', new Map([['k2', nextKey]]));
    for (const state of [old.issue().state, 'k2_short', `k2_${'A'.repeat(43)}=`]) {
      expect(() => activeOnly.providerSecrets(state)).toThrow(
        /^Social flow state cannot be processed\.$/u,
      );
    }
  });

  it('rejects invalid keyrings before issuing browser credentials', () => {
    expect(() => new VersionedSocialFlowCredentials('k3', versions)).toThrow(
      'Invalid social flow keyring.',
    );
    expect(
      () => new VersionedSocialFlowCredentials('invalid', new Map([['invalid', firstKey]])),
    ).toThrow('Invalid social flow keyring.');
    expect(
      () =>
        new VersionedSocialFlowCredentials(
          'k1',
          new Map([['k1', createSecretKey(Buffer.alloc(16, 1))]]),
        ),
    ).toThrow('Invalid social flow keyring.');
  });

  it('keeps the keyring that was supplied when constructed', () => {
    const input = new Map(versions);
    const adapter = new VersionedSocialFlowCredentials('k1', input);
    const state = adapter.issue().state;
    const expected = adapter.providerSecrets(state);
    input.delete('k1');

    expect(adapter.providerSecrets(state)).toEqual(expected);
  });
});
