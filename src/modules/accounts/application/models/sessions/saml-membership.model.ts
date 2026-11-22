/** The originating SAML membership retained by a session. */
export interface SamlMembership {
  // #region Properties
  /** The organization that owns the SAML connection. */
  readonly organizationId: string;

  /** The membership that vouched for the sign-in. */
  readonly memberId: string;
  // #endregion
}
