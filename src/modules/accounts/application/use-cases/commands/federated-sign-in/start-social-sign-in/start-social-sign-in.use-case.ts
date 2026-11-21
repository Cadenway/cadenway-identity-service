import { FederatedSignInFlow } from '../../../../../domain/aggregates/federated-sign-in/federated-sign-in-flow.aggregate.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { SocialProviderCatalog } from '../../../../ports/outbound/federation/social-sign-in/social-provider-catalog.port.js';
import type { SocialFlowCredentials } from '../../../../ports/outbound/security/federation/social-flow-credentials.port.js';
import type { SocialFlowUnitOfWork } from '../../../../ports/outbound/transactions/federation/social-flow-unit-of-work.port.js';
import type { StartSocialSignInInput } from './start-social-sign-in.input.js';
import type { StartSocialSignInOutput } from './start-social-sign-in.output.js';

/** Issues a browser-bound social sign-in before returning its provider redirect. */
export class StartSocialSignIn {
  // #region Constructor
  /** Binds the authority catalog, credential source, clock and global transaction. */
  public constructor(
    private readonly providers: SocialProviderCatalog,
    private readonly credentials: SocialFlowCredentials,
    private readonly clock: Clock,
    private readonly work: SocialFlowUnitOfWork,
  ) {}
  // #endregion

  // #region Methods
  /** Commits only hashed browser credentials and returns the new binding to the gateway. */
  public async execute(input: StartSocialSignInInput): Promise<StartSocialSignInOutput> {
    const provider = this.providers.find(input.provider);
    if (provider?.connection.provider !== input.provider) return { kind: 'unavailable' };
    const issued = this.credentials.issue();
    const secrets = this.credentials.providerSecrets(issued.state);
    let authorizationUrl: URL;
    try {
      authorizationUrl = provider.authorizationUrl({
        state: issued.state,
        pkceChallenge: secrets.pkceChallenge,
        nonce: secrets.nonce,
      });
    } catch {
      return { kind: 'unavailable' };
    }
    const flow = await this.work.run(async (store) => {
      const id = await store.nextFlowId();
      const flow = FederatedSignInFlow.issue(
        {
          id,
          connection: provider.connection,
          stateHash: this.credentials.digest(issued.state),
          browserBindingHash: this.credentials.digest(issued.browserBinding),
          persistent: input.rememberMe,
        },
        this.clock.now(),
      );
      await store.insert(flow);
      return flow;
    });
    return {
      kind: 'started',
      authorizationUrl: authorizationUrl.href,
      browserBinding: issued.browserBinding,
      expiresAt: new Date(flow.snapshot.expiresAtMs),
    };
  }
  // #endregion
}
