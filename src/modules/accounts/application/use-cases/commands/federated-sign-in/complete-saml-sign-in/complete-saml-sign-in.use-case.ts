import { FederatedSignInRefusedError } from '../../../../../domain/errors/federated-sign-in/federated-sign-in-refused.error.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { SamlSignInCatalog } from '../../../../ports/outbound/federation/saml/saml-sign-in-catalog.port.js';
import type { FederatedMembershipAuthority } from '../../../../ports/outbound/identity/memberships/federated-membership-authority.port.js';
import type { SocialFlowCredentials } from '../../../../ports/outbound/security/federation/social-flow-credentials.port.js';
import type { SocialFlowUnitOfWork } from '../../../../ports/outbound/transactions/federation/social-flow-unit-of-work.port.js';
import { samlRequestId } from '../../../../services/federated-sign-in/saml-request-id.service.js';
import type { CompleteSocialSignInOutput } from '../complete-social-sign-in/complete-social-sign-in.output.js';
import type { CompleteSamlSignInInput } from './complete-saml-sign-in.input.js';

/** Claims the SAML callback before verification and issues a receipt only for its current account link. */
export class CompleteSamlSignIn {
  // #region Constructor
  /** Binds the original authority catalog, credential hashing, clock and flow transactions. */
  public constructor(
    private readonly catalog: SamlSignInCatalog,
    private readonly credentials: Pick<SocialFlowCredentials, 'receipt' | 'digest'>,
    private readonly clock: Clock,
    private readonly work: SocialFlowUnitOfWork,
    private readonly membershipAuthority: FederatedMembershipAuthority | null,
  ) {}
  // #endregion

  // #region Methods
  /** Verifies only the persisted request, then checks the link and tenant eligibility before saving. */
  public async execute(input: CompleteSamlSignInInput): Promise<CompleteSocialSignInOutput> {
    const stateHash = this.credentials.digest(input.relayState);
    const browserBindingHash = this.credentials.digest(input.browserBinding);
    const claimed = await this.work.run(async (store) => {
      const record = await store.findByStateHash(stateHash);
      if (record?.flow.snapshot.connection.provider !== 'saml') return null;
      try {
        const flow = record.flow.claim(
          { provider: 'saml', stateHash, browserBindingHash },
          this.clock.now(),
        );
        return (await store.save(flow, record.version)) ? flow.snapshot : null;
      } catch (error) {
        if (error instanceof FederatedSignInRefusedError) return null;
        throw error;
      }
    });
    if (claimed?.connection.provider !== 'saml') return { kind: 'refused' };

    const authority = this.catalog.findByConnection(claimed.connection);
    if (authority === null) return { kind: 'refused' };
    const verification = await authority.verify({
      requestId: samlRequestId(claimed.id),
      requestIssuedAt: new Date(claimed.issuedAtMs),
      samlResponse: input.samlResponse,
    });
    if (verification.kind !== 'verified') return { kind: verification.kind };
    const { proof } = verification;

    if (this.membershipAuthority === null) {
      throw new Error('Organization membership authority is required for SAML sign-in.');
    }
    const selectedLink = await this.work.run((store) =>
      store.findLink({ ...claimed.connection, subject: proof.subject }),
    );
    if (selectedLink?.status !== 'active') return { kind: 'refused' };
    const membership = await this.membershipAuthority.find(
      claimed.connection.organizationId,
      selectedLink.userId,
    );
    if (membership?.organizationId !== claimed.connection.organizationId) {
      return { kind: 'refused' };
    }

    const receipt = this.credentials.receipt();
    return this.work.run(async (store) => {
      const record = await store.findByStateHash(stateHash);
      if (record === null) return { kind: 'refused' };
      const link = await store.findLink({ ...claimed.connection, subject: proof.subject });
      if (
        link?.status !== 'active' ||
        link.id !== selectedLink.id ||
        link.userId !== selectedLink.userId ||
        !(await store.isEligible(link.userId, claimed.connection, membership.memberId))
      ) {
        return { kind: 'refused' };
      }
      try {
        const flow = record.flow.complete(
          proof,
          link,
          this.credentials.digest(receipt),
          this.clock.now(),
          membership.memberId,
        );
        const phase = flow.snapshot.phase;
        if (phase.kind !== 'complete' || !(await store.save(flow, record.version))) {
          return { kind: 'refused' };
        }
        return { kind: 'issued', receipt, expiresAt: new Date(phase.continuation.expiresAtMs) };
      } catch (error) {
        if (error instanceof FederatedSignInRefusedError) return { kind: 'refused' };
        throw error;
      }
    });
  }
  // #endregion
}
