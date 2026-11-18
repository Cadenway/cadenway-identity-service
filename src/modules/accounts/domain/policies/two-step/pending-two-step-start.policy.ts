import type { PendingTwoStepStart } from '../../value-objects/two-step/pending-two-step-start.value-object.js';

/**
 * Function isPendingFor
 *
 * @description
 * Whether a started change can be completed now by the session of the request: it exists, belongs
 * to that session and has not expired ("A setup that expired, was replaced, or belongs to another
 * session, or no setup: `422 auth.two-step-setup-expired`").
 *
 * @param {PendingTwoStepStart | null} pending - The started change of the account, if any.
 * @param {string} sessionId - The session of the request.
 * @param {Date} now - The instant of the request.
 * @returns {boolean} `true` when it can be completed.
 */
export function isPendingFor(
  pending: PendingTwoStepStart | null,
  sessionId: string,
  now: Date,
): pending is PendingTwoStepStart {
  return (
    pending !== null &&
    pending.sessionId === sessionId &&
    now.getTime() < pending.expiresAt.getTime()
  );
}
