import type { TwoStepRequirement } from '../../models/two-step/two-step-requirement.model.js';
import type { SecurityKeyView } from './security-key-view.projection.js';

/**
 * Interface TwoStepVerificationView
 *
 * @description
 * The card "Vérification en deux étapes" of the account (`TwoStepVerification` of the contract),
 * without any secret.
 */
export interface TwoStepVerificationView {
  // #region Properties
  /**
   * Property configuredAt
   *
   * @description
   * When its authenticator app was configured, `null` while two-step verification is off.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly configuredAt: Date | null;

  /**
   * Property securityKeys
   *
   * @description
   * Its security keys, the oldest first.
   *
   * @type {readonly SecurityKeyView[]}
   * @readonly
   */
  readonly securityKeys: readonly SecurityKeyView[];

  /**
   * Property backupCodes
   *
   * @description
   * Its backup codes left, `null` while off.
   *
   * @type {{ readonly remaining: number; readonly total: number; readonly generatedAt: Date } | null}
   * @readonly
   */
  readonly backupCodes: {
    readonly remaining: number;
    readonly total: number;
    readonly generatedAt: Date;
  } | null;

  /**
   * Property requiredBy
   *
   * @description
   * The organizations whose policy requires it of the person.
   *
   * @type {readonly TwoStepRequirement[]}
   * @readonly
   */
  readonly requiredBy: readonly TwoStepRequirement[];
  // #endregion
}
