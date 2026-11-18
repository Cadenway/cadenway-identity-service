import type { Session } from '../../../domain/aggregates/session/session.aggregate.js';
import type { SessionsStore } from '../../models/session/sessions-store.model.js';

/**
 * Function findOpenSessionOf
 *
 * @description
 * Finds a session that is an open session of a person at an instant: a session of another person,
 * an unknown one and an ended one are all `null`, so a person learns nothing of the sessions of
 * others ("Session of the request" of `openapi/internal/identity-service.yaml`).
 *
 * @param {SessionsStore} store - The repositories of the transaction.
 * @param {string} userId - The person, the actor.
 * @param {string} sessionId - The session.
 * @param {Date} now - The instant.
 * @param {boolean} forUpdate - Whether to lock the session.
 * @returns {Promise<Session | null>} The open session, or `null`.
 */
export async function findOpenSessionOf(
  store: SessionsStore,
  userId: string,
  sessionId: string,
  now: Date,
  forUpdate: boolean,
): Promise<Session | null> {
  const session: Session | null = forUpdate
    ? await store.sessions.findForUpdate(sessionId)
    : await store.sessions.findById(sessionId);
  return session?.userId === userId && session.isActiveAt(now) ? session : null;
}

/**
 * Function lockOpenSessionOf
 *
 * @description
 * Locks every open session of a person, in the order of their ids, and returns the one asked when
 * it is one of them. A change that locks a session and then the others of the account would
 * deadlock with another one that locks them in a different order ("Déconnecter les autres" from two
 * devices, a change of password and a reset); every lock of several sessions takes them this way.
 *
 * @param {SessionsStore} store - The repositories of the transaction.
 * @param {string} userId - The person, the actor.
 * @param {string} sessionId - The session.
 * @param {Date} now - The instant.
 * @returns {Promise<Session | null>} The open session, locked, or `null`.
 */
export async function lockOpenSessionOf(
  store: SessionsStore,
  userId: string,
  sessionId: string,
  now: Date,
): Promise<Session | null> {
  const open: Session[] = await store.sessions.lockOpenOfUser(userId, now);
  return (
    open.find((session: Session) => session.id === sessionId && session.isActiveAt(now)) ?? null
  );
}

/**
 * Function revokeOpenSessions
 *
 * @description
 * Revokes the open sessions of a person, but one, each with `session.revoked.v1` credited to the
 * person: "Déconnecter les autres", a password reset with "Fermer mes autres sessions", and the
 * scheduling of the deletion of the account. Every session neither revoked nor expired is locked
 * first, in the order of their ids; one idle beyond the inactivity of its organization is closed as
 * well, without an event and without being counted ("closes for inactivity emits nothing"), so that
 * a later, longer inactivity of a policy cannot bring it back after the person ended it.
 *
 * @param {SessionsStore} store - The repositories of the transaction.
 * @param {string} userId - The person.
 * @param {string | null} exceptSessionId - The session that stays open, or `null` for none.
 * @param {Date} now - The instant of the revocation.
 * @returns {Promise<number>} The revoked sessions.
 */
export async function revokeOpenSessions(
  store: SessionsStore,
  userId: string,
  exceptSessionId: string | null,
  now: Date,
): Promise<number> {
  const unended: Session[] = await store.sessions.lockUnendedOfUser(userId, now);
  let revoked: number = 0;
  for (const session of unended) {
    if (session.id === exceptSessionId) {
      continue;
    }
    if (!session.isActiveAt(now)) {
      await store.sessions.revoke(session.closeForInactivity(now));
      continue;
    }
    const ended: Session = session.revoke(now);
    await store.sessions.revoke(ended);
    await store.events.sessionRevoked(ended, userId);
    revoked += 1;
  }
  return revoked;
}
