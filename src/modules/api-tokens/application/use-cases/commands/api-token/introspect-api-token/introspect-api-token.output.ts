/**
 * Type IntrospectApiTokenOutput
 *
 * @description
 * Whether a personal API token is active and whose it is (`ApiTokenIntrospection` of the contract):
 * the token, its user, its organization, the role of the user there, its scopes and its expiry.
 *
 * @type {{ readonly active: true; readonly tokenType: 'api-token'; readonly apiTokenId: string; readonly userId: string; readonly organizationId: string; readonly role: 'owner' | 'admin' | 'member' | 'guest'; readonly scopes: readonly string[]; readonly expiresAt: Date | null; readonly withheldOrganizationId: string | null } | { readonly active: false }}
 */
export type IntrospectApiTokenOutput =
  | {
      readonly active: true;
      readonly tokenType: 'api-token';
      readonly apiTokenId: string;
      readonly userId: string;
      readonly organizationId: string;
      readonly role: 'owner' | 'admin' | 'member' | 'guest';
      readonly scopes: readonly string[];
      readonly expiresAt: Date | null;
      readonly withheldOrganizationId: string | null;
    }
  | { readonly active: false };
