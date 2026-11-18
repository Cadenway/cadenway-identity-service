import type { User } from '../../../domain/aggregates/account/user.aggregate.js';
import type { Refusal } from '../../models/authentication/refusal.model.js';
import type { SessionAuthentication } from '../../models/sessions/session-authentication.model.js';
import type { AccountsStore } from '../../models/transactions/accounts-store.model.js';
import type { AccountSessions } from '../../ports/outbound/identity/sessions/account-sessions.port.js';

/**
 * Function lockActorSession
 *
 * @description
 * The first checks of a route of two-step verification ("the account and the session of the
 * request come before every other refusal", Decisions of the accounts `MODULE.md`): the account of
 * the path is the actor and exists (`user.not-found`), locked first, then the session of the request
 * is an open session of the actor (`session.not-found`). It also says whether that session has a
 * recent authentication that counts for the account, for the routes that require one.
 *
 * @param {AccountsStore} store - The repositories of the transaction.
 * @param {AccountSessions} sessions - The sessions of the person.
 * @param {{ readonly actorUserId: string; readonly userId: string; readonly sessionId: string }} request - The actor, the account of the path and the session.
 * @returns {Promise<{ readonly user: User; readonly recent: boolean } | Refusal>} The locked account and whether its window counts, or the refusal.
 */
export async function lockActorSession(
  store: AccountsStore,
  sessions: AccountSessions,
  request: { readonly actorUserId: string; readonly userId: string; readonly sessionId: string },
): Promise<{ readonly user: User; readonly recent: boolean } | Refusal> {
  if (request.actorUserId !== request.userId) {
    return { reason: 'user-not-found' };
  }
  const user: User | null = await store.users.lock(request.userId);
  if (user === null) {
    return { reason: 'user-not-found' };
  }
  const authentication: SessionAuthentication = await sessions.check(user.id, request.sessionId);
  if (authentication === 'not-found') {
    return { reason: 'session-not-found' };
  }
  return { user, recent: authentication === 'recent' };
}
