import type { StartSocialSignInOutput } from '../start-social-sign-in/start-social-sign-in.output.js';

/** A browser-bound SAML redirect or an opaque authority refusal. */
export type StartSamlSignInOutput = StartSocialSignInOutput | { readonly kind: 'refused' };
