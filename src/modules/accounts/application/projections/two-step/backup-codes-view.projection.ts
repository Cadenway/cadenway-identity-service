/**
 * Interface BackupCodesView
 *
 * @description
 * New backup codes, returned once (`BackupCodes` of the contract).
 */
export interface BackupCodesView {
  // #region Properties
  /**
   * Property codes
   *
   * @description
   * The 10 codes `XXXX-XXXX`. Secrets, never logged.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly codes: readonly string[];

  /**
   * Property generatedAt
   *
   * @description
   * When they were drawn.
   *
   * @type {Date}
   * @readonly
   */
  readonly generatedAt: Date;
  // #endregion
}
