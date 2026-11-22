/** The browser binding and redirect returned after a flow commits. */
export type StartSocialSignInOutput =
  | {
      readonly kind: 'started';
      readonly authorizationUrl: string;
      readonly browserBinding: string;
      readonly expiresAt: Date;
    }
  | { readonly kind: 'unavailable' };
