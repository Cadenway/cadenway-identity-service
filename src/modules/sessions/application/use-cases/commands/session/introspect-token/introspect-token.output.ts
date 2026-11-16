/**
 * Type IntrospectTokenOutput
 *
 * @description
 * Whether a token is active and whose it is (`Introspection` of the contract). The organization,
 * the role and the scopes are always empty in this version: a session belongs to an organization
 * once the organization selection exists.
 *
 * @type {{ readonly active: true; readonly tokenType: 'session'; readonly sessionId: string; readonly userId: string; readonly organizationId: null; readonly role: null; readonly scopes: readonly string[]; readonly expiresAt: Date } | { readonly active: false }}
 */
export type IntrospectTokenOutput =
  | {
      readonly active: true;
      readonly tokenType: 'session';
      readonly sessionId: string;
      readonly userId: string;
      readonly organizationId: null;
      readonly role: null;
      readonly scopes: readonly string[];
      readonly expiresAt: Date;
    }
  | { readonly active: false };
