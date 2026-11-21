/** Uses the work address only to select a verified domain. */
export interface StartSamlSignInInput {
  // #region Properties
  /** Work address supplied before opening a flow. */
  readonly email: string;

  /** Preserves the session persistence preference through the federated flow. */
  readonly rememberMe?: boolean;
  // #endregion
}
