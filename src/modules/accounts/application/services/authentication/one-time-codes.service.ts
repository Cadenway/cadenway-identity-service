import type { User } from '../../../domain/aggregates/account/user.aggregate.js';
import type { OneTimeCodeCheck } from '../../../domain/aggregates/one-time-codes/one-time-code-check.aggregate.js';
import { OneTimeCode } from '../../../domain/aggregates/one-time-codes/one-time-code.aggregate.js';
import { CodeThrottledError } from '../../../domain/errors/one-time-codes/code-throttled.error.js';
import type { AcceptedCodeRequest } from '../../../domain/policies/one-time-codes/accepted-code-request.policy.js';
import type { CodeRequestThrottle } from '../../../domain/policies/one-time-codes/code-request-throttle.policy.js';
import type { EmailAddress } from '../../../domain/value-objects/email/email-address.value-object.js';
import type { OneTimeCodePurpose } from '../../../domain/value-objects/one-time-code-purpose/one-time-code-purpose.value-object.js';
import { AccountRefusal } from '../../models/authentication/account-refusal.model.js';
import type { Refusal } from '../../models/authentication/refusal.model.js';
import type { AccountsStore } from '../../models/transactions/accounts-store.model.js';
import type { OneTimeCodeSecrets } from '../../ports/outbound/security/authentication/one-time-code-secrets.port.js';
import type { CodeSentView } from '../../projections/authentication/code-sent-view.projection.js';

/**
 * Function acceptCodeRequest
 *
 * @description
 * Applies the throttle of the code requests of an address: 30 seconds between two, 5 in an hour.
 *
 * @param {CodeRequestThrottle} throttle - The throttle of the address, locked.
 * @param {Date} now - The instant of the request.
 * @returns {AcceptedCodeRequest | Refusal} The throttle to store and when the next request is
 * accepted, or `auth.code-throttled` with `resendAvailableAt`.
 */
export function acceptCodeRequest(
  throttle: CodeRequestThrottle,
  now: Date,
): AcceptedCodeRequest | Refusal {
  try {
    return throttle.accept(now);
  } catch (error) {
    if (error instanceof CodeThrottledError) {
      return { reason: 'code-throttled', resendAvailableAt: error.resendAvailableAt };
    }
    throw error;
  }
}

/**
 * Function requestOneTimeCode
 *
 * @description
 * A request for a code, inside a unit of work, answered the same way whether or not a code is
 * issued: the address of the request is throttled first (the request counts, account or not), then
 * a code is issued only when an account of the address is eligible. The lock of the throttle row
 * serializes the requests of one address.
 *
 * @param {AccountsStore} store - The repositories of the transaction.
 * @param {OneTimeCodeSecrets} secrets - Draws and hashes the code.
 * @param {EmailAddress} email - The normalized address of the request.
 * @param {OneTimeCodePurpose} purpose - What the code proves.
 * @param {Date} now - The instant of the request.
 * @param {(user: User) => boolean} isEligible - Whether the account of the address gets a code.
 * @returns {Promise<CodeSentView>} The answer of the request.
 * @throws {AccountRefusal} `auth.code-throttled` within 30 seconds of the last accepted request of
 * the address, or once 5 were accepted in the hour.
 */
export async function requestOneTimeCode(
  store: AccountsStore,
  secrets: OneTimeCodeSecrets,
  email: EmailAddress,
  purpose: OneTimeCodePurpose,
  now: Date,
  isEligible: (user: User) => boolean,
): Promise<CodeSentView> {
  const accepted: AcceptedCodeRequest | Refusal = acceptCodeRequest(
    await store.codeRequests.lock(email),
    now,
  );
  if ('reason' in accepted) {
    throw new AccountRefusal(accepted);
  }
  await store.codeRequests.save(email, accepted.throttle);
  const user: User | null = await store.users.findByEmail(email, false);
  const expiresAt: Date =
    user !== null && isEligible(user)
      ? await issueOneTimeCode(store, secrets, user, purpose, now)
      : OneTimeCode.expiryFor(purpose, now);
  return { email: email.value, expiresAt, resendAvailableAt: accepted.resendAvailableAt };
}

/**
 * Function issueOneTimeCode
 *
 * @description
 * Issues a code inside a unit of work: the current code of the account and purpose stops working,
 * the new one is stored as its keyed hash, and `one-time-code.issued.v1` carries the digits to
 * notification-service. The digits exist in this function and in the restricted event only.
 *
 * @param {AccountsStore} store - The repositories of the transaction.
 * @param {OneTimeCodeSecrets} secrets - Draws and hashes the code.
 * @param {User} user - Account the code is for.
 * @param {OneTimeCodePurpose} purpose - What the code proves.
 * @param {Date} now - When the code is issued.
 * @param {EmailAddress} recipient - Where the e-mail goes: the address of the account, or the new
 * address of an `email-change`, whose code a signed-in person asked for.
 * @returns {Promise<Date>} When the new code stops working.
 */
export async function issueOneTimeCode(
  store: AccountsStore,
  secrets: OneTimeCodeSecrets,
  user: User,
  purpose: OneTimeCodePurpose,
  now: Date,
  recipient: EmailAddress = user.email,
): Promise<Date> {
  await store.codes.replaceCurrent(user.id, purpose, now);
  const code: string = secrets.generate();
  const stored: OneTimeCode = await store.codes.insert(
    OneTimeCode.issue(user.id, purpose, secrets.hash({ userId: user.id, purpose, code }), now),
  );
  const expiresAt: Date = stored.snapshot.expiresAt;
  await store.events.oneTimeCodeIssued({
    codeId: stored.id,
    user,
    purpose,
    code,
    expiresAt,
    recipient,
    requestedByUser: purpose === 'email-change',
  });
  return expiresAt;
}

/**
 * Function checkOneTimeCode
 *
 * @description
 * Checks a candidate against the current code of an account and purpose, inside a unit of work,
 * and stores what the check changed: the use of an accepted code, or the counted attempt of a wrong
 * one. Since a wrong attempt must stay counted, the caller commits before it throws the refusal.
 *
 * - `auth.code-invalid`: no code awaits a candidate, or the candidate is wrong;
 * - `auth.code-expired`: the current code no longer works (expired, five wrong attempts), or the
 *   candidate is a code that was used or replaced by a newer email.
 *
 * @param {AccountsStore} store - The repositories of the transaction.
 * @param {OneTimeCodeSecrets} secrets - Hashes the candidate.
 * @param {User} user - Account the candidate is checked for.
 * @param {OneTimeCodePurpose} purpose - What the code proves.
 * @param {string} candidate - The 6 digits typed; never logged.
 * @param {Date} now - The instant of the check.
 * @returns {Promise<Refusal | null>} `null` when the code is accepted, the refusal otherwise.
 */
export async function checkOneTimeCode(
  store: AccountsStore,
  secrets: OneTimeCodeSecrets,
  user: User,
  purpose: OneTimeCodePurpose,
  candidate: string,
  now: Date,
): Promise<Refusal | null> {
  const candidateHash: string = secrets.hash({ userId: user.id, purpose, code: candidate });
  const current: OneTimeCode | null = await store.codes.findCurrent(user.id, purpose);
  if (current === null) {
    return (await store.codes.endedWithHash(user.id, purpose, candidateHash))
      ? { reason: 'code-expired' }
      : { reason: 'code-invalid' };
  }
  const check: OneTimeCodeCheck = current.check(candidateHash, now);
  if (check.outcome === 'expired') {
    return { reason: 'code-expired' };
  }
  await store.codes.save(check.code);
  if (check.outcome === 'accepted') {
    return null;
  }
  return (await store.codes.endedWithHash(user.id, purpose, candidateHash))
    ? { reason: 'code-expired' }
    : { reason: 'code-invalid' };
}
