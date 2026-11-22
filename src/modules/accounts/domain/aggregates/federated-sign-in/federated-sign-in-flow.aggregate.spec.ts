import { describe, expect, it } from 'vitest';

import { FederatedSignInRefusedError } from '../../errors/federated-sign-in/federated-sign-in-refused.error.js';
import type { FederatedConnection } from '../../value-objects/federated-sign-in/federated-connection.value-object.js';
import type { FederatedFinishAuthority } from '../../value-objects/federated-sign-in/federated-finish-authority.value-object.js';
import type { LinkedFederatedAccount } from '../../value-objects/federated-sign-in/linked-federated-account.value-object.js';
import { FederatedSignInFlow } from './federated-sign-in-flow.aggregate.js';

const camilleId = '01938f6e-8a42-7d5b-b2c9-5e1f3a6d9c24';
const memberId = '01938f6e-0000-7000-8000-000000000078';
const atelierNordId = '01938f6e-6d1a-7c3e-9a51-2f0c4b8d7e10';
const anotherOrganizationId = '01938f6e-0000-7000-8000-000000000002';
const startedAt = new Date('2026-11-21T12:00:00Z');
const checkedAt = new Date('2026-11-21T12:01:00Z');
const stateHash = 'a'.repeat(64);
const browserBindingHash = 'b'.repeat(64);
const receiptHash = 'c'.repeat(64);
const flowId = 'federated-flow';
const subject = 'stable-subject';
const google = { provider: 'google', issuer: 'https://issuer.example' } as const;
const saml = {
  provider: 'saml',
  issuer: 'https://sso.atelier-nord.example',
  organizationId: atelierNordId,
  connectionId: 'atelier-nord-saml',
} as const;

function start(connection: FederatedConnection = google): FederatedSignInFlow {
  return FederatedSignInFlow.issue(
    { id: flowId, connection, stateHash, browserBindingHash, persistent: true },
    startedAt,
  );
}

function linkedAccount(connection: FederatedConnection = google): LinkedFederatedAccount {
  return {
    id: 'link',
    userId: camilleId,
    identity: { ...connection, subject },
    status: 'active',
  };
}

function complete(connection: FederatedConnection = google): FederatedSignInFlow {
  return start(connection)
    .claim({ provider: connection.provider, stateHash, browserBindingHash }, checkedAt)
    .complete(
      { connection, subject },
      linkedAccount(connection),
      receiptHash,
      checkedAt,
      connection.provider === 'saml' ? memberId : undefined,
    );
}

function authority(connection: FederatedConnection = google): FederatedFinishAuthority {
  return {
    account: { id: camilleId, enabled: true },
    link: linkedAccount(connection),
    activeMembership:
      connection.provider === 'saml'
        ? { userId: camilleId, organizationId: connection.organizationId, memberId }
        : null,
    maySignIn: true,
    twoStep: 'not-required',
  };
}

describe('FederatedSignInFlow', () => {
  it('claims an unexpired state only for the original provider and browser', () => {
    const flow = start();
    const input = { provider: 'google', stateHash, browserBindingHash } as const;
    expect(() => flow.claim({ ...input, provider: 'github' }, checkedAt)).toThrow(
      FederatedSignInRefusedError,
    );
    expect(() => flow.claim({ ...input, browserBindingHash: 'd'.repeat(64) }, checkedAt)).toThrow(
      FederatedSignInRefusedError,
    );
    expect(() => flow.claim({ ...input, stateHash: 'd'.repeat(64) }, checkedAt)).toThrow(
      FederatedSignInRefusedError,
    );
    const claimed = flow.claim(input, checkedAt);
    expect(claimed.snapshot.phase).toEqual({ kind: 'claimed', claimedAtMs: checkedAt.getTime() });
    expect(() => restore(claimed).claim(input, checkedAt)).toThrow(FederatedSignInRefusedError);
  });

  it('refuses claim at the ten-minute deadline and before issue', () => {
    const input = { provider: 'google', stateHash, browserBindingHash } as const;
    expect(() => start().claim(input, new Date('2026-11-21T12:10:00Z'))).toThrow(
      FederatedSignInRefusedError,
    );
    expect(() => start().claim(input, new Date('2026-11-21T11:59:59Z'))).toThrow(
      FederatedSignInRefusedError,
    );
  });

  it('requires an existing exact provider, issuer and subject link to issue a receipt', () => {
    const flow = start().claim({ provider: 'google', stateHash, browserBindingHash }, checkedAt);
    const proof = { connection: google, subject };
    const link = linkedAccount();
    for (const candidate of [
      null,
      { ...link, status: 'revoked' as const },
      { ...link, identity: { ...link.identity, provider: 'github' as const } },
      { ...link, identity: { ...link.identity, issuer: google.issuer.toUpperCase() } },
      { ...link, identity: { ...link.identity, subject: subject.toUpperCase() } },
    ]) {
      expect(() => flow.complete(proof, candidate, receiptHash, checkedAt)).toThrow(
        FederatedSignInRefusedError,
      );
    }
    expect(() => start().complete(proof, link, receiptHash, checkedAt)).toThrow(
      FederatedSignInRefusedError,
    );
    const completed = flow.complete(proof, link, receiptHash, checkedAt);
    expect(() => restore(completed).complete(proof, link, receiptHash, checkedAt)).toThrow(
      FederatedSignInRefusedError,
    );
  });

  it('requires a verified SAML proof from the exact connection chosen at start', () => {
    const flow = start(saml).claim({ provider: 'saml', stateHash, browserBindingHash }, checkedAt);
    for (const connection of [
      { ...saml, connectionId: 'another-connection' },
      { ...saml, organizationId: anotherOrganizationId },
      { ...saml, issuer: 'https://different-issuer.example' },
    ]) {
      expect(() =>
        flow.complete(
          { connection, subject },
          linkedAccount(saml),
          receiptHash,
          checkedAt,
          memberId,
        ),
      ).toThrow(FederatedSignInRefusedError);
    }
  });

  it('requires a SAML account link in the same organization and connection at completion and redemption', () => {
    const claimed = start(saml).claim(
      { provider: 'saml', stateHash, browserBindingHash },
      checkedAt,
    );
    const flow = complete(saml);
    for (const other of [
      { ...saml, organizationId: anotherOrganizationId },
      { ...saml, connectionId: 'another-connection' },
    ]) {
      const link = linkedAccount(other);
      expect(() =>
        claimed.complete({ connection: saml, subject }, link, receiptHash, checkedAt, memberId),
      ).toThrow(FederatedSignInRefusedError);
      expect(flow.redeem(receiptHash, { ...authority(saml), link }, checkedAt).decision).toEqual({
        kind: 'refused',
      });
    }
  });

  it('refuses to restore a legacy SAML receipt whose link identity has no authority scope', () => {
    const state = complete(saml).snapshot;
    if (state.phase.kind !== 'complete') throw new Error('Expected a SAML continuation.');
    Reflect.deleteProperty(state.phase.continuation.identity, 'organizationId');
    Reflect.deleteProperty(state.phase.continuation.identity, 'connectionId');
    expect(() => FederatedSignInFlow.restore(state)).toThrow(FederatedSignInRefusedError);
  });

  it('redeems once with the original persistence choice and explicit two-step decision', () => {
    const flow = complete();
    const current = authority();
    expect(flow.redeem(receiptHash, current, checkedAt).decision).toEqual({
      kind: 'session',
      userId: camilleId,
      organizationId: null,
      persistent: true,
      audit: { flowId, linkId: 'link', provider: 'google' },
    });
    expect(
      flow.redeem(receiptHash, { ...current, twoStep: 'trusted-device' }, checkedAt).decision.kind,
    ).toBe('session');
    const result = flow.redeem(
      receiptHash,
      { ...current, twoStep: 'challenge-required' },
      checkedAt,
    );
    expect(result.decision).toMatchObject({
      kind: 'challenge',
      userId: camilleId,
      persistent: true,
    });
    expect(() => restore(result.flow).redeem(receiptHash, current, checkedAt)).toThrow(
      FederatedSignInRefusedError,
    );
  });

  it('refuses an incorrect receipt digest or receipt at its two-minute deadline', () => {
    const flow = complete();
    expect(() => flow.redeem('e'.repeat(64), authority(), checkedAt)).toThrow(
      FederatedSignInRefusedError,
    );
    expect(() => flow.redeem(receiptHash, authority(), new Date('2026-11-21T12:03:00Z'))).toThrow(
      FederatedSignInRefusedError,
    );
  });

  it('consumes a valid receipt even if current linked account authority refuses sign-in', () => {
    const flow = complete();
    const current = authority();
    for (const changed of [
      { ...current, link: null },
      { ...current, link: { ...linkedAccount(), status: 'revoked' as const } },
      { ...current, link: { ...linkedAccount(), id: 'replacement-link' } },
      { ...current, account: { id: camilleId, enabled: false } },
      { ...current, account: { id: 'different-account', enabled: true } },
      { ...current, maySignIn: false },
    ]) {
      const result = flow.redeem(receiptHash, changed, checkedAt);
      expect(result.decision).toEqual({ kind: 'refused' });
      expect(() => restore(result.flow).redeem(receiptHash, current, checkedAt)).toThrow(
        FederatedSignInRefusedError,
      );
    }
  });

  it('refuses sign-in if authority supplies no two-step decision', () => {
    const incomplete = authority();
    Reflect.deleteProperty(incomplete, 'twoStep');
    expect(complete().redeem(receiptHash, incomplete, checkedAt).decision).toEqual({
      kind: 'refused',
    });
  });

  it('requires the exact live membership generation for the same SAML account and organization', () => {
    const flow = complete(saml);
    const current = authority(saml);
    expect(flow.redeem(receiptHash, current, checkedAt).decision).toMatchObject({
      kind: 'session',
      organizationId: atelierNordId,
    });
    for (const activeMembership of [
      null,
      { userId: camilleId, organizationId: anotherOrganizationId, memberId },
      { userId: 'different-account', organizationId: atelierNordId, memberId },
      { userId: camilleId, organizationId: atelierNordId, memberId: 'a-rejoined-membership' },
    ]) {
      expect(
        flow.redeem(receiptHash, { ...current, activeMembership }, checkedAt).decision,
      ).toEqual({
        kind: 'refused',
      });
    }
  });

  it('does not issue a new SAML receipt or redeem an old one without a bound membership', () => {
    const flow = start(saml).claim({ provider: 'saml', stateHash, browserBindingHash }, checkedAt);
    expect(() =>
      flow.complete({ connection: saml, subject }, linkedAccount(saml), receiptHash, checkedAt),
    ).toThrow(FederatedSignInRefusedError);

    const oldState = complete(saml).snapshot;
    if (oldState.phase.kind !== 'complete') throw new Error('Expected a SAML continuation.');
    Reflect.deleteProperty(oldState.phase.continuation, 'memberId');
    expect(
      FederatedSignInFlow.restore(oldState).redeem(receiptHash, authority(saml), checkedAt)
        .decision,
    ).toEqual({ kind: 'refused' });
  });

  it('refuses invalid stored lifetimes and raw credentials', () => {
    const stored = start().snapshot;
    expect(() =>
      FederatedSignInFlow.restore({ ...stored, expiresAtMs: stored.expiresAtMs + 1 }),
    ).toThrow(FederatedSignInRefusedError);
    expect(() => FederatedSignInFlow.restore({ ...stored, stateHash: 'raw-state' })).toThrow(
      FederatedSignInRefusedError,
    );
  });

  it('keeps only authorized persistence fields when callers carry provider or browser data', () => {
    const stored = start().snapshot;
    const candidate = {
      ...stored,
      connection: { ...google, providerCredential: 'synthetic-provider-fixture' },
      rawBrowserBinding: 'synthetic-browser-fixture',
    };
    expect(FederatedSignInFlow.restore(candidate).snapshot).toEqual(stored);
  });

  it('requires distinct state, browser binding and receipt credentials', () => {
    const stored = start().snapshot;
    expect(() => FederatedSignInFlow.restore({ ...stored, browserBindingHash: stateHash })).toThrow(
      FederatedSignInRefusedError,
    );
    const claimed = start().claim({ provider: 'google', stateHash, browserBindingHash }, checkedAt);
    for (const reusedHash of [stateHash, browserBindingHash]) {
      expect(() =>
        claimed.complete({ connection: google, subject }, linkedAccount(), reusedHash, checkedAt),
      ).toThrow(FederatedSignInRefusedError);
    }
  });
});

function restore(flow: FederatedSignInFlow): FederatedSignInFlow {
  return FederatedSignInFlow.restore(flow.snapshot);
}
