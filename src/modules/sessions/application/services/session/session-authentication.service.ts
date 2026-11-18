import type { Session } from '../../../domain/aggregates/session/session.aggregate.js';
import type { SessionsStore } from '../../models/session/sessions-store.model.js';
import { findOpenSessionOf } from './open-sessions.service.js';

/**
 * Function checkSessionAuthentication
 *
 * @description
 * Says whether the session of a request is an open session of the person and whether its person
 * proved who they are in the last 10 minutes ("Recent authentication" of
 * `openapi/internal/identity-service.yaml`, decision 4 of P2c).
 *
 * @param {SessionsStore} store - The repositories of the transaction.
 * @param {string} userId - The person, the actor.
 * @param {string} sessionId - The session of the request.
 * @param {Date} now - The instant of the request.
 * @param {boolean} forUpdate - Whether to lock the session until the end of the transaction.
 * @returns {Promise<'recent' | 'stale' | 'not-found'>} The status of the session.
 */
export async function checkSessionAuthentication(
  store: SessionsStore,
  userId: string,
  sessionId: string,
  now: Date,
  forUpdate: boolean,
): Promise<'recent' | 'stale' | 'not-found'> {
  const session: Session | null = await findOpenSessionOf(store, userId, sessionId, now, forUpdate);
  if (session === null) {
    return 'not-found';
  }
  return session.isRecentlyAuthenticatedAt(now) ? 'recent' : 'stale';
}
