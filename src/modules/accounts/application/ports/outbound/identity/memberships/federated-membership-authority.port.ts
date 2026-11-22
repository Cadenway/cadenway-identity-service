import type { SamlMembership } from '../../../../models/sessions/saml-membership.model.js';

/** Looks up current membership in the organization that owns the SAML connection. */
export interface FederatedMembershipAuthority {
  // #region Methods
  /** Returns the current SAML membership or null when it has been removed. */
  find(organizationId: string, userId: string): Promise<SamlMembership | null>;
  // #endregion
}
