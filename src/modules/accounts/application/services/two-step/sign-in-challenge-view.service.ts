import type { User } from '../../../domain/aggregates/account/user.aggregate.js';
import type { TwoStepVerification } from '../../../domain/aggregates/two-step/two-step-verification.aggregate.js';
import type { SecurityKeyRecord } from '../../models/two-step/security-key-record.model.js';
import type { AccountsStore } from '../../models/transactions/accounts-store.model.js';
import type { SignInChallengeView } from '../../projections/two-step/sign-in-challenge-view.projection.js';

/**
 * Function toSignInChallengeView
 *
 * @description
 * The challenge as the `202` of the sign-ins and its inspection answer it (`SignInChallenge` of the
 * contract, the screen Mfa.dc.html): the methods in the order of the contract (`authenticator-app`,
 * then `security-key` with a key, then `backup-code` while one is left), the names of the keys, the
 * oldest first ("Clé reconnue : YubiKey 5C NFC"), the backup codes left ("Il vous reste 7 codes
 * inutilisés.") and the end of a lockout of the answers.
 *
 * @param {AccountsStore} store - The repositories of the transaction.
 * @param {User} user - The account of the challenge.
 * @param {TwoStepVerification} verification - Its two-step verification.
 * @param {string} token - The token of the challenge, as the request or the issue carries it.
 * @param {Date} expiresAt - When the challenge expires.
 * @param {Date} now - The instant of the answer.
 * @returns {Promise<SignInChallengeView>} The challenge.
 */
export async function toSignInChallengeView(
  store: AccountsStore,
  user: User,
  verification: TwoStepVerification,
  token: string,
  expiresAt: Date,
  now: Date,
): Promise<SignInChallengeView> {
  const keys: SecurityKeyRecord[] = await store.securityKeys.listOfUser(user.id);
  const backupCodesRemaining: number = await store.backupCodes.countUnused(user.id);
  return {
    token,
    expiresAt,
    email: user.email.value,
    name: user.name,
    methods: [
      'authenticator-app',
      ...(keys.length > 0 ? ['security-key'] : []),
      ...(backupCodesRemaining > 0 ? ['backup-code'] : []),
    ],
    securityKeyNames: keys.map((key: SecurityKeyRecord): string => key.name),
    backupCodesRemaining,
    lockedUntil: verification.lockedUntilAt(now),
  };
}
