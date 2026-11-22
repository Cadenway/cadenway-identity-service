import type { FederatedConnection } from '../../../../../domain/value-objects/federated-sign-in/federated-connection.value-object.js';

/** An already validated social sign-in start request. */
export interface StartSocialSignInInput {
  // #region Properties
  /** Configured social identity provider. */
  readonly provider: Exclude<FederatedConnection['provider'], 'saml'>;

  /** Whether a later session may persist across browser restarts. */
  readonly rememberMe: boolean;
  // #endregion
}
