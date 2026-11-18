import type { OpenSession } from '@cadenway/contracts/types/internal/identity-service';

import type { OpenSessionView } from '../../../../application/projections/session/open-session-view.projection.js';

/**
 * Function toOpenSession
 *
 * @description
 * One open session in the shape of the contract (`OpenSession`).
 *
 * @param {OpenSessionView} view - The session.
 * @returns {OpenSession} The response item.
 */
export function toOpenSession(view: OpenSessionView): OpenSession {
  return {
    id: view.id,
    current: view.current,
    device: {
      type: view.device.type,
      browser: view.device.browser,
      browserVersion: view.device.browserVersion,
      os: view.device.os,
      osVersion: view.device.osVersion,
    },
    ipAddress: view.ipAddress,
    signedInAt: view.signedInAt.toISOString(),
    lastActiveAt: view.lastActiveAt.toISOString(),
    inactivityTimeoutMinutes: view.inactivityTimeoutMinutes,
    expiresAt: view.expiresAt.toISOString(),
  };
}
