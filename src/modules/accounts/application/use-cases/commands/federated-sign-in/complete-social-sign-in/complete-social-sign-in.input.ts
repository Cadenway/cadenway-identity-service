import type { FederatedConnection } from '../../../../../domain/value-objects/federated-sign-in/federated-connection.value-object.js';

/** An already validated, browser-bound social callback. */
export interface CompleteSocialSignInInput {
  // #region Properties
  /** Provider named by the callback route. */
  readonly provider: Exclude<FederatedConnection['provider'], 'saml'>;

  /** Single-use state issued to the provider. */
  readonly state: string;

  /** Browser credential paired with the issued flow. */
  readonly browserBinding: string;

  /** Provider response after strict boundary validation. */
  readonly response:
    | { readonly outcome: 'authorized'; readonly code: string }
    | { readonly outcome: 'denied'; readonly error: string };
  // #endregion
}
