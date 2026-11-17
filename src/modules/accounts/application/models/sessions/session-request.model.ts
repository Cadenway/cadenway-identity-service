import type { NewDeviceNotice } from './new-device-notice.model.js';
import type { SessionClient } from './session-client.model.js';

/**
 * Interface SessionRequest
 *
 * @description
 * The session a successful sign-in opens.
 */
export interface SessionRequest {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * Account the session signs in.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property persistent
   *
   * @description
   * Whether "Rester connecté pendant 30 jours" was ticked (`rememberMe`).
   *
   * @type {boolean}
   * @readonly
   */
  readonly persistent: boolean;

  /**
   * Property client
   *
   * @description
   * The browser of the session.
   *
   * @type {SessionClient}
   * @readonly
   */
  readonly client: SessionClient;

  /**
   * Property newDeviceNotice
   *
   * @description
   * Whom to tell when the session opens on a device the account did not use in the last 90 days
   * (`session.opened-on-new-device.v1`); `null` for the first session of the account, opened by
   * the sign-up verification, which tells nobody.
   *
   * @type {NewDeviceNotice | null}
   * @readonly
   */
  readonly newDeviceNotice: NewDeviceNotice | null;
  // #endregion
}
