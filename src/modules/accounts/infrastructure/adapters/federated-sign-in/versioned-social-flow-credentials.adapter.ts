import { createHash, createHmac, type KeyObject, randomBytes } from 'node:crypto';

import type { SocialFlowCredentials } from '../../../application/ports/outbound/security/federation/social-flow-credentials.port.js';

const credentialBytes: number = 32;
const versionPattern: RegExp = /^k[1-9]\d{0,8}$/u;
const statePattern: RegExp = /^(k[1-9]\d{0,8})_[A-Za-z0-9_-]{43}$/u;

/** Derives one provider value using a purpose separate from every other credential. */
function derive(key: KeyObject, purpose: 'nonce' | 'pkce', state: string): string {
  return createHmac('sha256', key)
    .update(`cadenway identity-service social flow v1 ${purpose}\0`, 'utf8')
    .update(state, 'utf8')
    .digest('base64url');
}

/** Issues independent browser credentials and derives provider values without storing them. */
export class VersionedSocialFlowCredentials implements SocialFlowCredentials {
  // #region Properties
  /** Isolates the supplied versions from later changes to the caller's map. */
  private readonly keys: ReadonlyMap<string, KeyObject>;
  // #endregion

  // #region Constructor
  /** Binds the issuance key and the retained versions used by all replicas. */
  public constructor(
    private readonly activeVersion: string,
    keys: ReadonlyMap<string, KeyObject>,
  ) {
    this.keys = new Map(keys);
    if (!this.keys.has(activeVersion)) throw new Error('Invalid social flow keyring.');
    for (const [version, key] of this.keys) {
      if (
        !versionPattern.test(version) ||
        key.type !== 'secret' ||
        key.symmetricKeySize !== credentialBytes
      ) {
        throw new Error('Invalid social flow keyring.');
      }
    }
  }
  // #endregion

  // #region Methods
  /** Issues independent 256-bit state and browser binding values. */
  public issue(): ReturnType<SocialFlowCredentials['issue']> {
    return {
      state: `${this.activeVersion}_${randomBytes(credentialBytes).toString('base64url')}`,
      browserBinding: randomBytes(credentialBytes).toString('base64url'),
    };
  }

  /** Issues a fresh continuation receipt of 256 bits. */
  public receipt(): string {
    return randomBytes(credentialBytes).toString('base64url');
  }

  /** Hashes an opaque browser credential for durable storage and lookup. */
  public digest(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }

  /** Uses the issued version to reproduce the verifier, S256 challenge and nonce. */
  public providerSecrets(state: string): ReturnType<SocialFlowCredentials['providerSecrets']> {
    const version = statePattern.exec(state)?.[1];
    const key = version === undefined ? undefined : this.keys.get(version);
    if (key === undefined) throw new Error('Social flow state cannot be processed.');

    const pkceVerifier = derive(key, 'pkce', state);
    return {
      pkceVerifier,
      pkceChallenge: createHash('sha256').update(pkceVerifier, 'ascii').digest('base64url'),
      nonce: derive(key, 'nonce', state),
    };
  }
  // #endregion
}
