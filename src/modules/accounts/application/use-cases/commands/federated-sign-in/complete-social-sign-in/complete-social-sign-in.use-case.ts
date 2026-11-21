import { FederatedSignInRefusedError } from '../../../../../domain/errors/federated-sign-in/federated-sign-in-refused.error.js';
import { SocialSignInProviderError } from '../../../../../domain/errors/federated-sign-in/social-sign-in-provider.error.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { SocialProviderCatalog } from '../../../../ports/outbound/federation/social-sign-in/social-provider-catalog.port.js';
import type { SocialFlowCredentials } from '../../../../ports/outbound/security/federation/social-flow-credentials.port.js';
import type { SocialFlowUnitOfWork } from '../../../../ports/outbound/transactions/federation/social-flow-unit-of-work.port.js';
import type { CompleteSocialSignInInput } from './complete-social-sign-in.input.js';
import type { CompleteSocialSignInOutput } from './complete-social-sign-in.output.js';

/** Claims a social callback before external verification and issues one continuation receipt. */
export class CompleteSocialSignIn {
  // #region Constructor
  /** Binds the catalog, server-held credential derivation, clock and transaction boundary. */
  public constructor(
    private readonly providers: SocialProviderCatalog,
    private readonly credentials: SocialFlowCredentials,
    private readonly clock: Clock,
    private readonly work: SocialFlowUnitOfWork,
  ) {}
  // #endregion

  // #region Methods
  /** Consumes matching state even on provider refusal and never opens a session. */
  public async execute(input: CompleteSocialSignInInput): Promise<CompleteSocialSignInOutput> {
    const stateHash = this.credentials.digest(input.state);
    const browserBindingHash = this.credentials.digest(input.browserBinding);
    const claimed = await this.work.run(async (store) => {
      const record = await store.findByStateHash(stateHash);
      if (record === null) return null;
      try {
        const flow = record.flow.claim(
          { provider: input.provider, stateHash, browserBindingHash },
          this.clock.now(),
        );
        return (await store.save(flow, record.version)) ? flow.snapshot.connection : null;
      } catch (error) {
        if (error instanceof FederatedSignInRefusedError) return null;
        throw error;
      }
    });
    if (claimed === null || input.response.outcome === 'denied') return { kind: 'refused' };
    const provider = this.providers.find(input.provider);
    if (
      provider?.connection.provider !== claimed.provider ||
      provider.connection.issuer !== claimed.issuer
    )
      return { kind: 'unavailable' };
    let proof;
    try {
      const { pkceVerifier, nonce } = this.credentials.providerSecrets(input.state);
      proof = await provider.verify({
        code: input.response.code,
        state: input.state,
        pkceVerifier,
        nonce,
      });
    } catch (error) {
      if (error instanceof SocialSignInProviderError && error.kind === 'refused')
        return { kind: 'refused' };
      return { kind: 'unavailable' };
    }
    if (
      proof.connection.provider !== claimed.provider ||
      proof.connection.issuer !== claimed.issuer
    ) {
      return { kind: 'refused' };
    }
    const receipt = this.credentials.receipt();
    return this.work.run(async (store) => {
      const record = await store.findByStateHash(stateHash);
      if (record === null) return { kind: 'refused' };
      const link = await store.findLink({ ...proof.connection, subject: proof.subject });
      if (link === null || !(await store.isEligible(link.userId, claimed))) {
        return { kind: 'refused' };
      }
      try {
        const flow = record.flow.complete(
          proof,
          link,
          this.credentials.digest(receipt),
          this.clock.now(),
        );
        if (!(await store.save(flow, record.version))) return { kind: 'refused' };
        const phase = flow.snapshot.phase;
        if (phase.kind !== 'complete') return { kind: 'refused' };
        return { kind: 'issued', receipt, expiresAt: new Date(phase.continuation.expiresAtMs) };
      } catch (error) {
        if (error instanceof FederatedSignInRefusedError) return { kind: 'refused' };
        throw error;
      }
    });
  }
  // #endregion
}
