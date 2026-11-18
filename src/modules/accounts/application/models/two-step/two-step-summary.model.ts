/**
 * Interface TwoStepSummary
 *
 * @description
 * What `user.two-step-verification-changed.v1` says of a change: which one, and the state after it.
 * No secret.
 */
export interface TwoStepSummary {
  // #region Properties
  /**
   * Property change
   *
   * @description
   * The change.
   *
   * @type {'enabled' | 'disabled' | 'authenticator-app-replaced' | 'backup-codes-regenerated' | 'security-key-added' | 'security-key-removed'}
   * @readonly
   */
  readonly change:
    | 'enabled'
    | 'disabled'
    | 'authenticator-app-replaced'
    | 'backup-codes-regenerated'
    | 'security-key-added'
    | 'security-key-removed';

  /**
   * Property enabled
   *
   * @description
   * Whether two-step verification is on after it.
   *
   * @type {boolean}
   * @readonly
   */
  readonly enabled: boolean;

  /**
   * Property methods
   *
   * @description
   * The configured methods after it: `authenticator-app`, then `security-key` with a key; empty
   * when off.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly methods: readonly string[];

  /**
   * Property backupCodesRemaining
   *
   * @description
   * Unused backup codes after it, 0 when off.
   *
   * @type {number}
   * @readonly
   */
  readonly backupCodesRemaining: number;

  /**
   * Property securityKey
   *
   * @description
   * The key added or removed, `null` for the other changes.
   *
   * @type {{ readonly id: string; readonly name: string } | null}
   * @readonly
   */
  readonly securityKey: { readonly id: string; readonly name: string } | null;
  // #endregion
}
