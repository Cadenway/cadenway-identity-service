/**
 * Type IntrospectTokenOutput
 *
 * @description
 * Whether a token is active and whose it is (`Introspection` of the contract): the session, its
 * account, its current organization with the role of the account there (both `null` without one),
 * and the scopes of a session, every scope.
 *
 * @type {{ readonly active: true; readonly tokenType: 'session'; readonly sessionId: string; readonly userId: string; readonly organizationId: string | null; readonly role: 'owner' | 'admin' | 'member' | 'guest' | null; readonly scopes: readonly string[]; readonly expiresAt: Date } | { readonly active: false }}
 */
export type IntrospectTokenOutput =
  | {
      readonly active: true;
      readonly tokenType: 'session';
      readonly sessionId: string;
      readonly userId: string;
      readonly organizationId: string | null;
      readonly role: 'owner' | 'admin' | 'member' | 'guest' | null;
      readonly scopes: readonly string[];
      readonly expiresAt: Date;
    }
  | { readonly active: false };
