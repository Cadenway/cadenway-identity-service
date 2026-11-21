import type { SamlSignInConnection } from './saml-sign-in-connection.port.js';

/** Selects preconfigured SAML authorities independently of callback attributes. */
export interface SamlSignInCatalog {
  // #region Methods
  /** Finds the unique preconfigured authority for a normalized, verified work domain. */
  findByVerifiedDomain(domain: string): SamlSignInConnection | null;

  /** Loads the exact authority previously bound to the flow. */
  findByConnection(connection: SamlSignInConnection['connection']): SamlSignInConnection | null;
  // #endregion
}
