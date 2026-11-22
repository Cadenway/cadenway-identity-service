import type { SamlMembership } from '../sessions/saml-membership.model.js';

/** Binds a preflight membership proof to the challenge subsequently locked. */
export interface ChallengeAuthority {
  // #region Properties
  /** The challenge observed before consulting Organization. */
  readonly challengeId: string;

  /** The account that owns the challenge. */
  readonly userId: string;

  /** The original SAML membership, when applicable. */
  readonly samlMembership: SamlMembership | null;
  // #endregion
}
