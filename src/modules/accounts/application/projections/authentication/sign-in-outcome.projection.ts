import type { SignInChallengeView } from '../two-step/sign-in-challenge-view.projection.js';
import type { SessionIssuedView } from './session-issued-view.projection.js';

/**
 * Type SignInOutcome
 *
 * @description
 * What a right first factor of a sign-in by password or by code leads to (P2c-2): a session
 * (`200 SessionIssued`), or, for an account with two-step verification on a device it does not
 * trust, a challenge and no session (`202 SignInChallenge`).
 *
 * @type {{ readonly kind: 'signed-in'; readonly issued: SessionIssuedView } | { readonly kind: 'challenge'; readonly challenge: SignInChallengeView }}
 */
export type SignInOutcome =
  | { readonly kind: 'signed-in'; readonly issued: SessionIssuedView }
  | { readonly kind: 'challenge'; readonly challenge: SignInChallengeView };
