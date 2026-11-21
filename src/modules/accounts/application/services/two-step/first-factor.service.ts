import type { User } from '../../../domain/aggregates/account/user.aggregate.js';
import { SignInChallenge } from '../../../domain/aggregates/two-step/sign-in-challenge.aggregate.js';
import type { TwoStepVerification } from '../../../domain/aggregates/two-step/two-step-verification.aggregate.js';
import type { FederatedChallengeBinding } from '../../../domain/value-objects/federated-sign-in/federated-challenge-binding.value-object.js';
import type { SessionClient } from '../../models/sessions/session-client.model.js';
import type { IssuedChallengeToken } from '../../models/two-step/issued-challenge-token.model.js';
import type { AccountsStore } from '../../models/transactions/accounts-store.model.js';
import type { DeviceReader } from '../../ports/outbound/device/accounts/device-reader.port.js';
import type { SessionOpener } from '../../ports/outbound/identity/sessions/session-opener.port.js';
import type { TrustedDevices } from '../../ports/outbound/identity/sessions/trusted-devices.port.js';
import type { ChallengeTokens } from '../../ports/outbound/security/two-step/challenge-tokens.port.js';
import type { SignInOutcome } from '../../projections/authentication/sign-in-outcome.projection.js';
import { completeSignIn } from '../authentication/sign-in-completion.service.js';
import { toSignInChallengeView } from './sign-in-challenge-view.service.js';

/**
 * Function completeFirstFactor
 *
 * @description
 * Completes the first factor of a verified account in the sign-in transaction:
 *
 * - without two-step verification, the sign-in completes with the recent-authentication method
 *   of the first factor, if any;
 * - with it, on a device the account trusts (`trustedDeviceToken`), the sign-in completes without
 *   a challenge and opens no window;
 * - otherwise a new challenge of the account replaces the previous one, valid 10 minutes, keeping
 *   `rememberMe` for the session its answer opens; no session is opened, no deletion cancelled, no
 *   device counted. For federation, the challenge retains the authority to check again when the
 *   second factor is answered. The token leaves once, in the `202`.
 *
 * A token unknown, expired, forgotten, of another account or malformed is ignored: the sign-in
 * answers its challenge, and tells nothing about the token.
 *
 * @param {AccountsStore} store - The repositories of the transaction.
 * @param {{ readonly sessions: SessionOpener; readonly devices: DeviceReader; readonly trustedDevices: TrustedDevices; readonly challengeTokens: ChallengeTokens }} ports - The ports of the sign-in.
 * @param {User} user - The verified account, locked by the caller.
 * @param {{ readonly persistent: boolean; readonly client: SessionClient; readonly trustedDeviceToken: string | undefined }} request - The sign-in.
 * @param {Date} now - The instant of the sign-in.
 * @returns {Promise<SignInOutcome>} The session, or the challenge.
 */
export async function completeFirstFactor(
  store: AccountsStore,
  ports: {
    readonly sessions: SessionOpener;
    readonly devices: DeviceReader;
    readonly trustedDevices: TrustedDevices;
    readonly challengeTokens: ChallengeTokens;
  },
  user: User,
  request: {
    readonly persistent: boolean;
    readonly client: SessionClient;
    readonly trustedDeviceToken: string | undefined;
    readonly authentication?: 'password' | null;
    readonly federatedBinding?: FederatedChallengeBinding;
  },
  now: Date,
): Promise<SignInOutcome> {
  const verification: TwoStepVerification | null = await store.twoStep.find(user.id);
  if (verification === null) {
    return {
      kind: 'signed-in',
      issued: await completeSignIn(
        store,
        ports.sessions,
        ports.devices,
        user,
        request.persistent,
        request.client,
        request.authentication === undefined ? 'password' : request.authentication,
      ),
    };
  }
  if (
    request.trustedDeviceToken !== undefined &&
    (await ports.trustedDevices.isTrusted(user.id, request.trustedDeviceToken))
  ) {
    return {
      kind: 'signed-in',
      issued: await completeSignIn(
        store,
        ports.sessions,
        ports.devices,
        user,
        request.persistent,
        request.client,
        null,
      ),
    };
  }
  const issued: IssuedChallengeToken = ports.challengeTokens.issue();
  const challenge: SignInChallenge = await store.challenges.replace(
    SignInChallenge.issue(
      user.id,
      issued.tokenHash,
      request.persistent,
      now,
      request.federatedBinding,
    ),
  );
  return {
    kind: 'challenge',
    challenge: await toSignInChallengeView(
      store,
      user,
      verification,
      issued.token,
      challenge.expiresAt,
      now,
    ),
  };
}
