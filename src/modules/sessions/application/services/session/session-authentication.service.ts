import type { Session } from '../../../domain/aggregates/session/session.aggregate.js';
import type { CheckedAuthentication } from '../../models/session/checked-authentication.model.js';
import type { SessionsStore } from '../../models/session/sessions-store.model.js';
import { findOpenSessionOf } from './open-sessions.service.js';

/**
 * Function checkSessionAuthentication
 *
 * @description
 * Says whether the session of a request is an open session of the person and whether its person
 * proved who they are in the last 10 minutes in a way that counts for the account ("Recent
 * authentication" of `openapi/internal/identity-service.yaml`, decision 4 of P2c): for an account
 * with two-step verification, a second factor only (P2c-2).
 *
 * @param {SessionsStore} store - The repositories of the transaction.
 * @param {string} userId - The person, the actor.
 * @param {string} sessionId - The session of the request.
 * @param {Date} now - The instant of the request.
 * @param {boolean} forUpdate - Whether to lock the session until the end of the transaction.
 * @returns {Promise<CheckedAuthentication>} The status of the session and of the account.
 */
export async function checkSessionAuthentication(
  store: SessionsStore,
  userId: string,
  sessionId: string,
  now: Date,
  forUpdate: boolean,
): Promise<CheckedAuthentication> {
  const session: Session | null = await findOpenSessionOf(store, userId, sessionId, now, forUpdate);
  const twoStepVerificationEnabled: boolean = await store.enrollments.isEnrolled(userId);
  if (session === null) {
    return { status: 'not-found', twoStepVerificationEnabled };
  }
  return {
    status: session.isRecentlyAuthenticatedAt(now, twoStepVerificationEnabled) ? 'recent' : 'stale',
    twoStepVerificationEnabled,
  };
}
