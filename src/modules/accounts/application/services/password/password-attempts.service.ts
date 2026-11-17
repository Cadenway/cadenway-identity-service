import type { User } from '../../../domain/aggregates/account/user.aggregate.js';
import { AccountLockedError } from '../../../domain/errors/password/account-locked.error.js';
import { PasswordTooShortError } from '../../../domain/errors/password/password-too-short.error.js';
import type { PasswordFailure } from '../../../domain/policies/password/password-failure.policy.js';
import type { PasswordLockout } from '../../../domain/policies/password/password-lockout.policy.js';
import { assertAcceptablePassword } from '../../../domain/policies/password/password.policy.js';
import type { EmailAddress } from '../../../domain/value-objects/email/email-address.value-object.js';
import type { Refusal } from '../../models/authentication/refusal.model.js';
import type { AccountsStore } from '../../models/transactions/accounts-store.model.js';
import type { CompromisedPasswords } from '../../ports/outbound/security/authentication/compromised-passwords.port.js';

/**
 * Function countPasswordAttempt
 *
 * @description
 * Counts a check of the current password of a signed-in person as a failure in advance, with the
 * failed sign-ins of the address of the account ("Lockout" of
 * `openapi/internal/identity-service.yaml`): the re-authentication and the change of password share
 * the lockout of the password sign-in. Locks the lockout row of the address; the caller commits
 * before checking the hash, so concurrent attempts are counted one after the other and the hash
 * never holds a connection.
 *
 * @param {AccountsStore} store - The repositories of the transaction.
 * @param {EmailAddress} email - The address of the account.
 * @param {Date} now - The instant of the attempt.
 * @returns {Promise<PasswordFailure | Refusal>} The answer if the password turns out wrong, or
 * `auth.account-locked` during a lockout, without counting.
 */
export async function countPasswordAttempt(
  store: AccountsStore,
  email: EmailAddress,
  now: Date,
): Promise<PasswordFailure | Refusal> {
  const lockout: PasswordLockout = await store.signInAttempts.lock(email);
  try {
    lockout.assertUnlocked(now);
  } catch (error) {
    if (error instanceof AccountLockedError) {
      return { reason: 'account-locked', lockedUntil: error.lockedUntil };
    }
    throw error;
  }
  const failure: PasswordFailure = lockout.recordFailure(now);
  await store.signInAttempts.save(email, failure.lockout);
  return failure;
}

/**
 * Function wrongPasswordRefusal
 *
 * @description
 * The answer to a wrong current password, once counted: `auth.password-incorrect` with the
 * attempts left, or `auth.account-locked` for the failure that used the last one.
 *
 * @param {PasswordFailure} failure - The counted failure.
 * @returns {Refusal} The refusal.
 */
export function wrongPasswordRefusal(failure: PasswordFailure): Refusal {
  return failure.lockedUntil === null
    ? { reason: 'password-incorrect', remainingAttempts: failure.remainingAttempts }
    : { reason: 'account-locked', lockedUntil: failure.lockedUntil };
}

/**
 * Function clearPasswordAttempts
 *
 * @description
 * Ends the count of the failed passwords of an address: a right password, and a completed reset.
 *
 * @param {AccountsStore} store - The repositories of the transaction.
 * @param {EmailAddress} email - The address.
 * @returns {Promise<void>} Resolves once written.
 */
export async function clearPasswordAttempts(
  store: AccountsStore,
  email: EmailAddress,
): Promise<void> {
  const lockout: PasswordLockout = await store.signInAttempts.lock(email);
  await store.signInAttempts.save(email, lockout.recordSuccess());
}

/**
 * Function settlePasswordCheck
 *
 * @description
 * The last transaction of a password checked outside any transaction: locks the lockout row of the
 * address, then the account (the order of every sign-in), and clears the attempt counted in advance
 * only when the hash checked is still the one of the account. A change, a reset or a new sign-up
 * that committed during the check leaves the attempt counted: the password checked is no longer the
 * password of the account, and a session opened or authenticated with it would survive the reset
 * that closed every other one.
 *
 * @param {AccountsStore} store - The repositories of the transaction.
 * @param {string} userId - The account checked.
 * @param {EmailAddress} email - The address whose attempt was counted.
 * @param {string | null} passwordHash - The hash the password was checked against.
 * @returns {Promise<User | 'account-gone' | 'password-moved'>} The account, locked, or why the
 * check no longer holds.
 */
export async function settlePasswordCheck(
  store: AccountsStore,
  userId: string,
  email: EmailAddress,
  passwordHash: string | null,
): Promise<User | 'account-gone' | 'password-moved'> {
  const lockout: PasswordLockout = await store.signInAttempts.lock(email);
  const user: User | null = await store.users.lock(userId);
  if (user === null) {
    return 'account-gone';
  }
  if ((await store.credentials.findHash(user.id)) !== passwordHash) {
    return 'password-moved';
  }
  await store.signInAttempts.save(email, lockout.recordSuccess());
  return user;
}

/**
 * Function refuseNewPassword
 *
 * @description
 * Checks a new password against the rules of the sign-up (decision 1 of P2c): 12 characters at
 * least, no composition rule, not in the list of compromised passwords.
 *
 * @param {CompromisedPasswords} compromised - The list of compromised passwords.
 * @param {string} password - The new password.
 * @returns {Promise<Refusal | null>} `auth.password-too-short` or `auth.password-compromised`, or
 * `null` when it is acceptable.
 */
export async function refuseNewPassword(
  compromised: CompromisedPasswords,
  password: string,
): Promise<Refusal | null> {
  try {
    assertAcceptablePassword(password);
  } catch (error) {
    if (error instanceof PasswordTooShortError) {
      return { reason: 'password-too-short', minLength: error.minLength };
    }
    throw error;
  }
  return (await compromised.includes(password)) ? { reason: 'password-compromised' } : null;
}
