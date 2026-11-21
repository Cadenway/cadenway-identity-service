/** Generates independent browser credentials and reconstructs provider secrets server-side. */
export interface SocialFlowCredentials {
  // #region Methods
  /** Draws a fresh 256-bit state and browser binding. */
  issue(): { readonly state: string; readonly browserBinding: string };

  /** Draws a fresh 256-bit, single-use continuation receipt. */
  receipt(): string;

  /** Hashes an opaque credential for storage and lookup. */
  digest(value: string): string;

  /**
   * Derives distinct provider-only PKCE and nonce using a server-held secret and this state.
   * The issued state identifies its derivation key version. All replicas share the keys and
   * retain each previous version throughout every issued flow's lifetime.
   */
  providerSecrets(state: string): {
    readonly pkceVerifier: string;
    readonly pkceChallenge: string;
    readonly nonce: string;
  };
  // #endregion
}
