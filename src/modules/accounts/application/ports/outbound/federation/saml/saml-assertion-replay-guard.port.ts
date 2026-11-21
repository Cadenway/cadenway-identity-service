import type { SamlSignInConnection } from './saml-sign-in-connection.port.js';

/** Atomically records the digest of a signed assertion ID within its organization and connection. */
export interface SamlAssertionReplayGuard {
  // #region Methods
  /** Returns false if the assertion is already recorded and its acceptance window has not expired. */
  claim(
    connection: SamlSignInConnection['connection'],
    assertionKey: string,
    expiresAt: Date,
  ): Promise<boolean>;
  // #endregion
}
