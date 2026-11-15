import type { Session } from '../../domain/session.js';

/**
 * Interface SessionEvents
 *
 * @description
 * The events of the sessions module, appended to the outbox in the transaction of the change. None
 * belongs to an organization yet (`organizationId: null`).
 */
export interface SessionEvents {
  // #region Methods
  /**
   * Method sessionRevoked
   *
   * @description
   * Appends `session.revoked.v1` with the version of the revoked session.
   *
   * @param {Session} session - The revoked session.
   * @param {string} actorUserId - The user who revoked it.
   * @returns {Promise<void>} Resolves once appended.
   */
  sessionRevoked(session: Session, actorUserId: string): Promise<void>;
  // #endregion
}
