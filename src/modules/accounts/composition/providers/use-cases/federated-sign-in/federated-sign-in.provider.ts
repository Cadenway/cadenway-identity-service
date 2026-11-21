import { randomBytes } from 'node:crypto';

import { CONFIG } from '@cadenway/nest-common';
import { SystemTransactionRunner } from '@cadenway/nest-common/database';
import type { FactoryProvider } from '@nestjs/common';

import type { AppConfig } from '../../../../../../config/app-config.js';
import { LockActiveMembership } from '../../../../../memberships/public/membership/lock-active-membership.js';
import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import { CompleteSamlSignIn } from '../../../../application/use-cases/commands/federated-sign-in/complete-saml-sign-in/complete-saml-sign-in.use-case.js';
import { CompleteSocialSignIn } from '../../../../application/use-cases/commands/federated-sign-in/complete-social-sign-in/complete-social-sign-in.use-case.js';
import { StartSamlSignIn } from '../../../../application/use-cases/commands/federated-sign-in/start-saml-sign-in/start-saml-sign-in.use-case.js';
import { StartSocialSignIn } from '../../../../application/use-cases/commands/federated-sign-in/start-social-sign-in/start-social-sign-in.use-case.js';
import type { FederatedConnection } from '../../../../domain/value-objects/federated-sign-in/federated-connection.value-object.js';
import { digestFederatedCredential } from '../../../../infrastructure/adapters/federated-sign-in/versioned-social-flow-credentials.adapter.js';
import { ConfiguredSamlSignInCatalog } from '../../../../infrastructure/adapters/saml/configured-saml-sign-in-catalog.adapter.js';
import { DrizzleSamlAssertionReplayGuard } from '../../../../infrastructure/persistence/drizzle/repositories/federated-sign-in/drizzle-saml-assertion-replay-guard.repository.js';
import { SystemSocialFlowUnitOfWork } from '../../../../infrastructure/persistence/drizzle/transactions/federated-sign-in/system-social-flow.unit-of-work.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';
import { FEDERATED_SIGN_IN_AUTHORITY } from '../../../tokens/federated-sign-in/federated-sign-in-authority.token.js';
import { createSocialSignInRuntime } from '../../adapters/federated-sign-in/social-sign-in-runtime.provider.js';

const federationRuntime = Symbol('FederationRuntime');
const federationWork = Symbol('FederationWork');

interface FederationRuntime {
  // #region Properties
  /** OAuth authorities and versioned state credentials, when configured. */
  readonly social: ReturnType<typeof createSocialSignInRuntime>;

  /** Organization connections and asserted replay protection, when configured. */
  readonly saml: ConfiguredSamlSignInCatalog | null;
  // #endregion
}

interface FederationAuthority {
  // #region Properties
  /** Rechecks that the flow's exact configured connection can still authenticate. */
  readonly isAllowed: (userId: string, connection: FederatedConnection) => Promise<boolean>;

  /** Locks and checks an active membership in the caller's transaction. */
  readonly hasActiveMembership: (userId: string, organizationId: string) => Promise<boolean>;
  // #endregion
}

function randomCredential(): string {
  return randomBytes(32).toString('base64url');
}

const samlCredentials = {
  issue: () => ({ state: randomCredential(), browserBinding: randomCredential() }),
  receipt: randomCredential,
  digest: digestFederatedCredential,
};

/** Binds the configured providers to the same eligibility policy at callback and receipt redemption. */
export const federatedSignInProviders: readonly FactoryProvider[] = [
  {
    provide: federationRuntime,
    inject: [CONFIG, SystemTransactionRunner],
    useFactory: (config: AppConfig, runner: SystemTransactionRunner): FederationRuntime => ({
      social: createSocialSignInRuntime(config),
      saml:
        config.SAML_SIGN_IN_CONNECTIONS === undefined
          ? null
          : new ConfiguredSamlSignInCatalog(
              config.SAML_SIGN_IN_CONNECTIONS,
              new DrizzleSamlAssertionReplayGuard(runner),
            ),
    }),
  },
  {
    provide: FEDERATED_SIGN_IN_AUTHORITY,
    inject: [federationRuntime, LockActiveMembership],
    useFactory: (
      runtime: FederationRuntime,
      memberships: LockActiveMembership,
    ): FederationAuthority => ({
      isAllowed: (_userId, connection) =>
        Promise.resolve(
          connection.provider === 'saml'
            ? (runtime.saml?.findByConnection(connection) ?? null) !== null
            : runtime.social?.providers.find(connection.provider)?.connection.issuer ===
                connection.issuer,
        ),
      hasActiveMembership: async (userId, organizationId) =>
        (await memberships.execute({ organizationId, userId })) !== null,
    }),
  },
  {
    provide: federationWork,
    inject: [SystemTransactionRunner, FEDERATED_SIGN_IN_AUTHORITY],
    useFactory: (runner: SystemTransactionRunner, authority: FederationAuthority) =>
      new SystemSocialFlowUnitOfWork(runner, async (_scope, userId, connection) => {
        if (!(await authority.isAllowed(userId, connection))) return false;
        return (
          connection.provider !== 'saml' ||
          (await authority.hasActiveMembership(userId, connection.organizationId))
        );
      }),
  },
  {
    provide: StartSocialSignIn,
    inject: [federationRuntime, CLOCK, federationWork],
    useFactory: ({ social }: FederationRuntime, clock: Clock, work: SystemSocialFlowUnitOfWork) =>
      social === null
        ? null
        : new StartSocialSignIn(social.providers, social.credentials, clock, work),
  },
  {
    provide: CompleteSocialSignIn,
    inject: [federationRuntime, CLOCK, federationWork],
    useFactory: ({ social }: FederationRuntime, clock: Clock, work: SystemSocialFlowUnitOfWork) =>
      social === null
        ? null
        : new CompleteSocialSignIn(social.providers, social.credentials, clock, work),
  },
  {
    provide: StartSamlSignIn,
    inject: [federationRuntime, CLOCK, federationWork],
    useFactory: ({ saml }: FederationRuntime, clock: Clock, work: SystemSocialFlowUnitOfWork) =>
      saml === null ? null : new StartSamlSignIn(saml, samlCredentials, clock, work),
  },
  {
    provide: CompleteSamlSignIn,
    inject: [federationRuntime, CLOCK, federationWork],
    useFactory: ({ saml }: FederationRuntime, clock: Clock, work: SystemSocialFlowUnitOfWork) =>
      saml === null ? null : new CompleteSamlSignIn(saml, samlCredentials, clock, work),
  },
];
