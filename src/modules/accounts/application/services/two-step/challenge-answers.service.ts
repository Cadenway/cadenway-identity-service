import type { User } from '../../../domain/aggregates/account/user.aggregate.js';
import type { SignInChallenge } from '../../../domain/aggregates/two-step/sign-in-challenge.aggregate.js';
import type { TwoStepFailure } from '../../../domain/aggregates/two-step/two-step-failure.aggregate.js';
import type { TwoStepVerification } from '../../../domain/aggregates/two-step/two-step-verification.aggregate.js';
import type { Refusal } from '../../models/authentication/refusal.model.js';
import type { SessionClient } from '../../models/sessions/session-client.model.js';
import type { TrustedDeviceGrant } from '../../models/sessions/trusted-device-grant.model.js';
import type { ChallengeAuthority } from '../../models/two-step/challenge-authority.model.js';
import type { FederatedMembershipAuthority } from '../../ports/outbound/identity/memberships/federated-membership-authority.port.js';
import type { AccountsUnitOfWork } from '../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { AccountsStore } from '../../models/transactions/accounts-store.model.js';
import type { DeviceReader } from '../../ports/outbound/device/accounts/device-reader.port.js';
import type { SessionOpener } from '../../ports/outbound/identity/sessions/session-opener.port.js';
import type { TrustedDevices } from '../../ports/outbound/identity/sessions/trusted-devices.port.js';
import type { ChallengeTokens } from '../../ports/outbound/security/two-step/challenge-tokens.port.js';
import type { SessionIssuedView } from '../../projections/authentication/session-issued-view.projection.js';
import { completeSignIn } from '../authentication/sign-in-completion.service.js';

/** Resolves a SAML challenge's current membership outside its answer transaction. */
export async function authorizeChallenge(
  work: AccountsUnitOfWork,
  tokens: ChallengeTokens,
  token: string,
  now: Date,
  authority: FederatedMembershipAuthority | null,
): Promise<ChallengeAuthority | null> {
  const hash = tokens.hashOf(token);
  if (hash === null) return null;
  const challenge = await work.run((store) => store.challenges.findByTokenHash(hash, false));
  if (!challenge?.isUsableAt(now)) return null;
  const binding = challenge.snapshot.federatedBinding;
  if (binding?.connection.provider !== 'saml') {
    return { challengeId: challenge.id, userId: challenge.userId, samlMembership: null };
  }
  if (authority === null) {
    throw new Error('Organization membership authority is required for SAML sign-in.');
  }
  const membership = await authority.find(binding.connection.organizationId, challenge.userId);
  return membership === null || membership.memberId !== binding.memberId
    ? null
    : { challengeId: challenge.id, userId: challenge.userId, samlMembership: membership };
}

/**
 * Function lockChallenge
 *
 * @description
 * Finds the challenge of an answer and locks, in this order, the account, the challenge and the
 * two-step verification of the account, the lock order of every flow that writes them (the account
 * before its two-step rows). A token that is malformed, unknown, answered, replaced or expired, a
 * challenge whose account is gone or has no two-step verification any more, answer
 * `auth.challenge-expired`, checked first, so it counts no attempt. A federated challenge also
 * requires the original link and connection to remain authorized in the answer transaction.
 *
 * @param {AccountsStore} store - The repositories of the transaction.
 * @param {ChallengeTokens} tokens - Hashes the token.
 * @param {string} token - The token of the answer.
 * @param {Date} now - The instant of the answer.
 * @returns {Promise<{ readonly user: User; readonly challenge: SignInChallenge; readonly verification: TwoStepVerification } | Refusal>} The locked rows, or the refusal.
 */
export async function lockChallenge(
  store: AccountsStore,
  tokens: ChallengeTokens,
  token: string,
  now: Date,
  authority?: ChallengeAuthority,
): Promise<
  | {
      readonly user: User;
      readonly challenge: SignInChallenge;
      readonly verification: TwoStepVerification;
    }
  | Refusal
> {
  const tokenHash: string | null = tokens.hashOf(token);
  const found: SignInChallenge | null =
    tokenHash === null ? null : await store.challenges.findByTokenHash(tokenHash, false);
  if (tokenHash === null || found === null) {
    return { reason: 'challenge-expired' };
  }
  const user: User | null = await store.users.lock(found.userId);
  const challenge: SignInChallenge | null = await store.challenges.findByTokenHash(tokenHash, true);
  const verification: TwoStepVerification | null =
    user === null ? null : await store.twoStep.lock(user.id);
  if (user === null || challenge?.isUsableAt(now) !== true || verification === null) {
    return { reason: 'challenge-expired' };
  }
  const binding = challenge.snapshot.federatedBinding;
  if (
    binding !== null &&
    (!user.isVerified ||
      !(await store.mayFinishFederatedChallenge(
        user.id,
        binding,
        authority?.samlMembership?.memberId,
      )))
  ) {
    await store.challenges.deleteOfUser(user.id);
    return { reason: 'challenge-expired' };
  }
  return { user, challenge, verification };
}

/**
 * Function lockoutRefusal
 *
 * @description
 * The refusal of every answer during a lockout of the two-step answers of the account
 * (`auth.two-step-locked`, 15 minutes after the fifth wrong answer in a row).
 *
 * @param {TwoStepVerification} verification - The two-step verification of the account.
 * @param {Date} now - The instant of the answer.
 * @returns {Refusal | null} The refusal, or `null` without a lockout.
 */
export function lockoutRefusal(verification: TwoStepVerification, now: Date): Refusal | null {
  const lockedUntil: Date | null = verification.lockedUntilAt(now);
  return lockedUntil === null ? null : { reason: 'two-step-locked', lockedUntil };
}

/**
 * Function refuseWrongAnswer
 *
 * @description
 * Counts a wrong answer of the account, across its challenges and its re-authentication codes, and
 * stores the count in the transaction, which commits before the refusal: `remainingAttempts` 4 to 1,
 * then the fifth locks the answers (`auth.two-step-locked`).
 *
 * @param {AccountsStore} store - The repositories of the transaction.
 * @param {TwoStepVerification} verification - The locked two-step verification.
 * @param {Date} now - The instant of the answer.
 * @param {'two-step-code-invalid' | 'security-key-refused'} reason - The refusal of the answer.
 * @returns {Promise<Refusal>} The refusal to answer.
 */
export async function refuseWrongAnswer(
  store: AccountsStore,
  verification: TwoStepVerification,
  now: Date,
  reason: 'two-step-code-invalid' | 'security-key-refused',
): Promise<Refusal> {
  const failure: TwoStepFailure = verification.recordWrongAnswer(now);
  await store.twoStep.update(failure.verification);
  return failure.lockedUntil === null
    ? { reason, remainingAttempts: failure.remainingAttempts }
    : { reason: 'two-step-locked', lockedUntil: failure.lockedUntil };
}

/**
 * Function finishChallenge
 *
 * @description
 * What the right answer of a challenge does, in its one transaction: the challenge is used up, the
 * count of wrong answers ends (with the accepted time step of the app, when it was the answer), the
 * browser becomes a trusted device with `trustDevice`, and the sign-in completes as a `200` does
 * (`completeSignIn`): the session opens with the `rememberMe` of the sign-in, for the browser of the
 * answer, with a window of recent authentication by a second factor; a scheduled deletion is
 * cancelled; the device is counted for "Nouvelle connexion".
 *
 * @param {AccountsStore} store - The repositories of the transaction.
 * @param {{ readonly sessions: SessionOpener; readonly devices: DeviceReader; readonly trustedDevices: TrustedDevices }} ports - The ports of the sign-in.
 * @param {User} user - The locked account.
 * @param {SignInChallenge} challenge - The locked challenge.
 * @param {TwoStepVerification} verification - The two-step verification after the right answer.
 * @param {{ readonly trustDevice: boolean; readonly client: SessionClient }} answer - The answer.
 * @returns {Promise<SessionIssuedView>} The session, its token, the account and the trusted device.
 */
export async function finishChallenge(
  store: AccountsStore,
  ports: {
    readonly sessions: SessionOpener;
    readonly devices: DeviceReader;
    readonly trustedDevices: TrustedDevices;
  },
  user: User,
  challenge: SignInChallenge,
  verification: TwoStepVerification,
  answer: { readonly trustDevice: boolean; readonly client: SessionClient },
  authority: ChallengeAuthority,
): Promise<SessionIssuedView> {
  await store.challenges.deleteOfUser(user.id);
  await store.twoStep.update(verification);
  const trusted: TrustedDeviceGrant | null = answer.trustDevice
    ? await ports.trustedDevices.trust(user.id)
    : null;
  return completeSignIn(
    store,
    ports.sessions,
    ports.devices,
    user,
    challenge.persistent,
    answer.client,
    'two-step',
    trusted,
    authority.samlMembership,
  );
}
