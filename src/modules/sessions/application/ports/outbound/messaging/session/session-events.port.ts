import type { Session } from '../../../../../domain/aggregates/session/session.aggregate.js';
import type { DeviceDescription } from '../../../../models/session/device-description.model.js';

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

  /**
   * Method sessionOpenedOnNewDevice
   *
   * @description
   * Appends `session.opened-on-new-device.v1` for a session a sign-in has just opened.
   *
   * @param {Session} session - The new session.
   * @param {{ readonly device: DeviceDescription; readonly ipAddress: string }} client - The
   * device and the address of the browser.
   * @param {{ readonly email: string; readonly name: string; readonly language: string; readonly timeZone: string }} notice
   * - Whom the e-mail addresses.
   * @returns {Promise<void>} Resolves once appended.
   */
  sessionOpenedOnNewDevice(
    session: Session,
    client: { readonly device: DeviceDescription; readonly ipAddress: string },
    notice: {
      readonly email: string;
      readonly name: string;
      readonly language: string;
      readonly timeZone: string;
    },
  ): Promise<void>;
  // #endregion
}
