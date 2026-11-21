/** A sanitized failure to obtain the required proof for social sign-in. */
export class SocialSignInProviderError extends Error {
  // #region Constructor
  /** Carries only the safe failure category. */
  public constructor(public readonly kind: 'refused' | 'unavailable') {
    super(
      kind === 'refused'
        ? 'Federated sign-in cannot continue.'
        : 'Federated authority unavailable.',
    );
  }
  // #endregion
}
