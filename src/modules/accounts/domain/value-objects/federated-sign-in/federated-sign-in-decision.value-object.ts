import type { FederatedConnection } from './federated-connection.value-object.js';

/** The ordinary sign-in result to issue using the verified account and the stored persistence choice. */
export type FederatedSignInDecision =
  | { readonly kind: 'refused' }
  | {
      readonly kind: 'session' | 'challenge';
      readonly userId: string;
      readonly organizationId: string | null;
      readonly persistent: boolean;
      readonly audit: {
        readonly flowId: string;
        readonly linkId: string;
        readonly provider: FederatedConnection['provider'];
      };
    };
