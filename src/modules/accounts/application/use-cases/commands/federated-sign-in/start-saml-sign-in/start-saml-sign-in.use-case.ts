import { FederatedSignInFlow } from '../../../../../domain/aggregates/federated-sign-in/federated-sign-in-flow.aggregate.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { SamlSignInCatalog } from '../../../../ports/outbound/federation/saml/saml-sign-in-catalog.port.js';
import type { SocialFlowCredentials } from '../../../../ports/outbound/security/federation/social-flow-credentials.port.js';
import type { SocialFlowUnitOfWork } from '../../../../ports/outbound/transactions/federation/social-flow-unit-of-work.port.js';
import { samlRequestId } from '../../../../services/federated-sign-in/saml-request-id.service.js';
import type { StartSamlSignInInput } from './start-saml-sign-in.input.js';
import type { StartSamlSignInOutput } from './start-saml-sign-in.output.js';

/** Selects a SAML tenant by verified work domain and commits its browser-bound flow. */
export class StartSamlSignIn {
  // #region Constructor
  /** Binds the catalog, opaque credential source, clock and global flow transaction. */
  public constructor(
    private readonly catalog: SamlSignInCatalog,
    private readonly credentials: Pick<SocialFlowCredentials, 'issue' | 'digest'>,
    private readonly clock: Clock,
    private readonly work: SocialFlowUnitOfWork,
  ) {}
  // #endregion

  // #region Methods
  /** Returns the IdP redirect after persisting the unique request identity and credential hashes. */
  public async execute(input: StartSamlSignInInput): Promise<StartSamlSignInOutput> {
    const at = input.email.lastIndexOf('@');
    if (at <= 0) return { kind: 'refused' };
    const domain = input.email.slice(at + 1).toLowerCase();
    const authority = this.catalog.findByVerifiedDomain(domain);
    if (authority === null) return { kind: 'refused' };

    const issued = this.credentials.issue();
    const flow = await this.work.run(async (store) => {
      const flow = FederatedSignInFlow.issue(
        {
          id: await store.nextFlowId(),
          connection: authority.connection,
          stateHash: this.credentials.digest(issued.state),
          browserBindingHash: this.credentials.digest(issued.browserBinding),
          persistent: input.rememberMe ?? false,
        },
        this.clock.now(),
      );
      await store.insert(flow);
      return flow.snapshot;
    });

    try {
      const url = await authority.authorizationUrl(samlRequestId(flow.id), issued.state);
      return {
        kind: 'started',
        authorizationUrl: url.href,
        browserBinding: issued.browserBinding,
        expiresAt: new Date(flow.expiresAtMs),
      };
    } catch {
      return { kind: 'unavailable' };
    }
  }
  // #endregion
}
