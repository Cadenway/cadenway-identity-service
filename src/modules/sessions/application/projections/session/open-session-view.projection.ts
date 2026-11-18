import type { DeviceDescription } from '../../models/session/device-description.model.js';

/**
 * Interface OpenSessionView
 *
 * @description
 * One row of "Sessions actives" (`OpenSession` of `openapi/internal/identity-service.yaml`): the
 * device read from the stored `User-Agent`, the address of the sign-in, the last activity and
 * whether it is the session of the request ("Cet appareil"). No place is derived from the address.
 */
export interface OpenSessionView {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the session.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property current
   *
   * @description
   * Whether it is the session of the request.
   *
   * @type {boolean}
   * @readonly
   */
  readonly current: boolean;

  /**
   * Property device
   *
   * @description
   * The device, read from the stored `User-Agent`.
   *
   * @type {DeviceDescription}
   * @readonly
   */
  readonly device: DeviceDescription;

  /**
   * Property ipAddress
   *
   * @description
   * Address of the browser of the sign-in that opened it.
   *
   * @type {string}
   * @readonly
   */
  readonly ipAddress: string;

  /**
   * Property signedInAt
   *
   * @description
   * When the sign-in opened it.
   *
   * @type {Date}
   * @readonly
   */
  readonly signedInAt: Date;

  /**
   * Property lastActiveAt
   *
   * @description
   * Its last recorded activity, at most a minute behind.
   *
   * @type {Date}
   * @readonly
   */
  readonly lastActiveAt: Date;

  /**
   * Property expiresAt
   *
   * @description
   * When it ends at the latest.
   *
   * @type {Date}
   * @readonly
   */
  readonly expiresAt: Date;

  /**
   * Property inactivityTimeoutMinutes
   *
   * @description
   * Minutes of inactivity after which the session closes, from the policy of its organization, 720
   * without one (`OpenSession.inactivityTimeoutMinutes`).
   *
   * @type {number}
   * @readonly
   */
  readonly inactivityTimeoutMinutes: number;
  // #endregion
}
