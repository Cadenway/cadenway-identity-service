import type { FederatedConnection } from '../../../../../domain/value-objects/federated-sign-in/federated-connection.value-object.js';
import type { SocialSignInProvider } from './social-sign-in-provider.port.js';

/** Resolves only locally configured social authorities. */
export interface SocialProviderCatalog {
  // #region Methods
  /** Returns the configured authority for this provider or null when it is unavailable. */
  find(provider: Exclude<FederatedConnection['provider'], 'saml'>): SocialSignInProvider | null;
  // #endregion
}
