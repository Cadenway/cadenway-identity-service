/** The callback either issues one continuation or returns an opaque refusal. */
export type CompleteSocialSignInOutput =
  | { readonly kind: 'issued'; readonly receipt: string; readonly expiresAt: Date }
  | { readonly kind: 'refused' }
  | { readonly kind: 'unavailable' };
