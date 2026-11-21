/** The SAML POST response and the matching browser credentials supplied by the gateway. */
export interface CompleteSamlSignInInput {
  // #region Properties
  /** The original Base64 form field after form decoding. */
  readonly samlResponse: string;

  /** The one-use opaque state returned by the configured IdP. */
  readonly relayState: string;

  /** The opaque browser binding from the gateway's flow cookie. */
  readonly browserBinding: string;
  // #endregion
}
