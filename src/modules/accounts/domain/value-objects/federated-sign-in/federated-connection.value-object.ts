/** The configured authority selected before opening an authentication flow. */
export type FederatedConnection =
  | { readonly provider: 'google' | 'github' | 'microsoft' | 'gitlab'; readonly issuer: string }
  | {
      readonly provider: 'saml';
      readonly issuer: string;
      readonly organizationId: string;
      readonly connectionId: string;
    };
