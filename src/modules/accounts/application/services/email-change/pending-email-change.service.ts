import type { AccountsStore } from '../../models/transactions/accounts-store.model.js';

/**
 * Function dropPendingEmailChange
 *
 * @description
 * Drops the pending change of address of an account and makes its code stop working, as a change
 * or a reset of the password, and the scheduling of the deletion, do (`POST /v1/me/email-change`:
 * "a change or a reset of the password, drop it").
 *
 * @param {AccountsStore} store - The repositories of the transaction.
 * @param {string} userId - The account.
 * @param {Date} now - When it is dropped.
 * @returns {Promise<void>} Resolves once written.
 */
export async function dropPendingEmailChange(
  store: AccountsStore,
  userId: string,
  now: Date,
): Promise<void> {
  await store.emailChanges.drop(userId);
  await store.codes.replaceCurrent(userId, 'email-change', now);
}
