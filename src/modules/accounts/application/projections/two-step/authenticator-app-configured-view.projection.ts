import type { BackupCodesView } from './backup-codes-view.projection.js';
import type { TwoStepVerificationView } from './two-step-verification-view.projection.js';

/**
 * Interface AuthenticatorAppConfiguredView
 *
 * @description
 * The answer of the confirmation of an authenticator app (`AuthenticatorAppConfigured` of the
 * contract).
 */
export interface AuthenticatorAppConfiguredView {
  // #region Properties
  /**
   * Property twoStepVerification
   *
   * @description
   * The card after the confirmation.
   *
   * @type {TwoStepVerificationView}
   * @readonly
   */
  readonly twoStepVerification: TwoStepVerificationView;

  /**
   * Property backupCodes
   *
   * @description
   * The 10 backup codes when two-step verification turned on, `null` for a reconfiguration.
   *
   * @type {BackupCodesView | null}
   * @readonly
   */
  readonly backupCodes: BackupCodesView | null;
  // #endregion
}
