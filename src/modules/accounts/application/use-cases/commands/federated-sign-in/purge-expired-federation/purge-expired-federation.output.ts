/** Counts expired federation rows removed by a maintenance operation. */
export interface PurgeExpiredFederationOutput {
  // #region Properties
  /** Removed browser-bound flows and continuation receipts. */
  readonly flows: number;

  /** Removed SAML replay markers past their stored retention deadline. */
  readonly assertions: number;
  // #endregion
}
