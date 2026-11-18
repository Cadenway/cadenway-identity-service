import type {
  SecurityKeyAssertionOptions,
  SignInChallenge,
  WebAuthnRequestOptions,
} from '@cadenway/contracts/types/internal/identity-service';

import type { SignInChallengeView } from '../../../../application/projections/two-step/sign-in-challenge-view.projection.js';
import type { WebAuthnOptionsView } from '../../../../application/projections/two-step/web-authn-options-view.projection.js';

/**
 * Function toSignInChallenge
 *
 * @description
 * Maps a two-step challenge to `SignInChallenge` of the contract, the `202` of the sign-ins and
 * the `200` of its inspection: the authenticator app is the primary method of every account with
 * two-step verification. The token is a secret the gateway passes on and never logs.
 *
 * @param {SignInChallengeView} view - The challenge.
 * @returns {SignInChallenge} The body.
 */
export function toSignInChallenge(view: SignInChallengeView): SignInChallenge {
  return {
    token: view.token,
    expiresAt: view.expiresAt.toISOString(),
    email: view.email,
    name: view.name,
    primaryMethod: 'authenticator-app',
    methods: [...view.methods],
    securityKeys: view.securityKeyNames.map((name: string) => ({ name })),
    backupCodesRemaining: view.backupCodesRemaining,
    lockedUntil: view.lockedUntil?.toISOString() ?? null,
  };
}

/**
 * Function toSecurityKeyAssertionOptions
 *
 * @description
 * Maps the WebAuthn request options of a challenge to `SecurityKeyAssertionOptions` of the
 * contract, as `@simplewebauthn/server` generated them.
 *
 * @param {WebAuthnOptionsView} view - The options and their expiry.
 * @returns {SecurityKeyAssertionOptions} The body.
 */
export function toSecurityKeyAssertionOptions(
  view: WebAuthnOptionsView,
): SecurityKeyAssertionOptions {
  return {
    options: view.options as WebAuthnRequestOptions,
    expiresAt: view.expiresAt.toISOString(),
  };
}
