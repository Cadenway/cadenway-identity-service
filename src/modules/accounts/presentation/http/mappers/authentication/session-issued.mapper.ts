import type { SessionIssued } from '@cadenway/contracts/types/internal/identity-service';

import type { SessionIssuedView } from '../../../../application/projections/authentication/session-issued-view.projection.js';
import { toUser } from '../accounts/user.mapper.js';

/**
 * Function toSessionIssued
 *
 * @description
 * Maps a successful sign-in to `SessionIssued`. `token` leaves this service here only: the gateway
 * writes it into the cookie and never logs it.
 *
 * @param {SessionIssuedView} view - The answer of the use case.
 * @returns {SessionIssued} The body of the response.
 */
export function toSessionIssued(view: SessionIssuedView): SessionIssued {
  return {
    token: view.session.token,
    session: {
      id: view.session.id,
      expiresAt: view.session.expiresAt.toISOString(),
      persistent: view.session.persistent,
    },
    user: toUser(view.user),
    deletionCancelled: view.deletionCancelled,
  };
}
