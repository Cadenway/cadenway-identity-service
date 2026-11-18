import type { Refusal } from '../../models/authentication/refusal.model.js';
import type { AccountsStore } from '../../models/transactions/accounts-store.model.js';

/**
 * Function reauthenticationRequired
 *
 * @description
 * The refusal of a guarded route without a recent authentication that counts for the account
 * ("Recent authentication" of the internal contract): `details.methods` is `[password]` without
 * two-step verification, `[authenticator-app]` with it, since a password never confirms such an
 * account and a security key does not confirm in this version (P2c-2).
 *
 * @param {AccountsStore} store - The repositories of the transaction.
 * @param {string} userId - The account.
 * @returns {Promise<Refusal>} `auth.reauthentication-required` with its methods.
 */
export async function reauthenticationRequired(
  store: AccountsStore,
  userId: string,
): Promise<Refusal> {
  return {
    reason: 'reauthentication-required',
    methods: (await store.twoStep.find(userId)) === null ? ['password'] : ['authenticator-app'],
  };
}
