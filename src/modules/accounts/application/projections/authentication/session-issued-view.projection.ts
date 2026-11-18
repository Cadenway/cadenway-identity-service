import type { TrustedDeviceGrant } from '../../models/sessions/trusted-device-grant.model.js';
import type { OpenedSession } from '../../models/sessions/opened-session.model.js';
import type { AccountView } from '../accounts/account-view.projection.js';

/**
 * Interface SessionIssuedView
 *
 * @description
 * The answer of a successful sign-in (`SessionIssued` of the contract).
 */
export interface SessionIssuedView {
  // #region Properties
  /**
   * Property session
   *
   * @description
   * The session and its token, which leaves this service here only.
   *
   * @type {OpenedSession}
   * @readonly
   */
  readonly session: OpenedSession;

  /**
   * Property user
   *
   * @description
   * The signed-in account.
   *
   * @type {AccountView}
   * @readonly
   */
  readonly user: AccountView;

  /**
   * Property deletionCancelled
   *
   * @description
   * Whether this sign-in cancelled the scheduled deletion of the account.
   *
   * @type {boolean}
   * @readonly
   */
  readonly deletionCancelled: boolean;

  /**
   * Property trustedDevice
   *
   * @description
   * The browser made a trusted device by the answer of a challenge with `trustDevice`, `null`
   * otherwise (P2c-2).
   *
   * @type {TrustedDeviceGrant | null}
   * @readonly
   */
  readonly trustedDevice: TrustedDeviceGrant | null;
  // #endregion
}
