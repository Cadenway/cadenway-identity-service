import { SystemTransactionRunner, TenantTransactionRunner } from '@cadenway/nest-common/database';
import { Module } from '@nestjs/common';
import type { FactoryProvider } from '@nestjs/common';

import { SystemClock } from '../../infrastructure/system-clock.js';
import { MembershipsModule } from '../memberships/memberships.module.js';
import { FindActiveMembership } from '../memberships/public/membership/find-active-membership.js';
import type { FindActiveMembershipOutput } from '../memberships/public/membership/find-active-membership.js';
import type { ActiveMembership } from './application/models/api-token/active-membership.model.js';
import type { ActiveMemberships } from './application/ports/outbound/memberships/api-token/active-memberships.port.js';
import type { ApiTokenSecrets } from './application/ports/outbound/security/api-token/api-token-secrets.port.js';
import type { Clock } from './application/ports/outbound/time/api-token/clock.port.js';
import type { ApiTokensUnitOfWork } from './application/ports/outbound/transactions/api-token/api-tokens-unit-of-work.port.js';
import { CreateApiToken } from './application/use-cases/commands/api-token/create-api-token/create-api-token.use-case.js';
import { IntrospectApiToken } from './application/use-cases/commands/api-token/introspect-api-token/introspect-api-token.use-case.js';
import { RevokeApiToken } from './application/use-cases/commands/api-token/revoke-api-token/revoke-api-token.use-case.js';
import { ListApiTokens } from './application/use-cases/queries/api-token/list-api-tokens/list-api-tokens.use-case.js';
import { RandomApiTokenSecrets } from './infrastructure/adapters/crypto/random-api-token-secrets.adapter.js';
import { SystemApiTokensUnitOfWork } from './infrastructure/persistence/drizzle/transactions/api-token/system-api-tokens.unit-of-work.js';
import { TenantApiTokensUnitOfWork } from './infrastructure/persistence/drizzle/transactions/api-token/tenant-api-tokens.unit-of-work.js';
import { ApiTokenIntrospectionController } from './presentation/http/controllers/api-token-introspection/api-token-introspection.controller.js';
import { ApiTokensController } from './presentation/http/controllers/api-token/api-tokens.controller.js';

/** Identifies the unit of work of the routes of a session, on the tenant runner. */
const TENANT_UNIT_OF_WORK: unique symbol = Symbol('TenantApiTokensUnitOfWork');

/** Identifies the unit of work of the introspection, on the system runner. */
const SYSTEM_UNIT_OF_WORK: unique symbol = Symbol('SystemApiTokensUnitOfWork');

/** Identifies the ApiTokenSecrets port. */
const SECRETS: unique symbol = Symbol('ApiTokenSecrets');

/** Identifies the ActiveMemberships port of the api-tokens module. */
const ACTIVE_MEMBERSHIPS: unique symbol = Symbol('ApiTokensActiveMemberships');

/** Identifies the Clock port of the api-tokens module. */
const CLOCK: unique symbol = Symbol('ApiTokensClock');

/**
 * Constant providers
 *
 * @description
 * The ports and the use cases of the module. `ActiveMemberships` is bound to
 * `FindActiveMembership`, the provider `MembershipsModule` exports; called inside the system
 * transaction of the introspection, the reading joins it.
 *
 * @type {FactoryProvider[]}
 */
const providers: FactoryProvider[] = [
  {
    provide: TENANT_UNIT_OF_WORK,
    inject: [TenantTransactionRunner],
    useFactory: (runner: TenantTransactionRunner): ApiTokensUnitOfWork =>
      new TenantApiTokensUnitOfWork(runner),
  },
  {
    provide: SYSTEM_UNIT_OF_WORK,
    inject: [SystemTransactionRunner],
    useFactory: (runner: SystemTransactionRunner): ApiTokensUnitOfWork =>
      new SystemApiTokensUnitOfWork(runner),
  },
  { provide: SECRETS, useFactory: (): ApiTokenSecrets => new RandomApiTokenSecrets() },
  { provide: CLOCK, useFactory: (): Clock => new SystemClock() },
  {
    provide: ACTIVE_MEMBERSHIPS,
    inject: [FindActiveMembership],
    useFactory: (findActiveMembership: FindActiveMembership): ActiveMemberships => ({
      find: async (organizationId: string, userId: string): Promise<ActiveMembership | null> => {
        const membership: FindActiveMembershipOutput | null = await findActiveMembership.execute({
          organizationId,
          userId,
        });
        return membership === null
          ? null
          : {
              memberId: membership.memberId,
              organizationId: membership.organizationId,
              role: membership.role,
            };
      },
    }),
  },
  {
    provide: CreateApiToken,
    inject: [TENANT_UNIT_OF_WORK, SECRETS, CLOCK],
    useFactory: (
      unitOfWork: ApiTokensUnitOfWork,
      secrets: ApiTokenSecrets,
      clock: Clock,
    ): CreateApiToken => new CreateApiToken(unitOfWork, secrets, clock),
  },
  {
    provide: ListApiTokens,
    inject: [TENANT_UNIT_OF_WORK, CLOCK],
    useFactory: (unitOfWork: ApiTokensUnitOfWork, clock: Clock): ListApiTokens =>
      new ListApiTokens(unitOfWork, clock),
  },
  {
    provide: RevokeApiToken,
    inject: [TENANT_UNIT_OF_WORK, CLOCK],
    useFactory: (unitOfWork: ApiTokensUnitOfWork, clock: Clock): RevokeApiToken =>
      new RevokeApiToken(unitOfWork, clock),
  },
  {
    provide: IntrospectApiToken,
    inject: [SYSTEM_UNIT_OF_WORK, SECRETS, ACTIVE_MEMBERSHIPS, CLOCK],
    useFactory: (
      unitOfWork: ApiTokensUnitOfWork,
      secrets: ApiTokenSecrets,
      memberships: ActiveMemberships,
      clock: Clock,
    ): IntrospectApiToken => new IntrospectApiToken(unitOfWork, secrets, memberships, clock),
  },
];

/**
 * Class ApiTokensModule
 *
 * @description
 * Composition root of the personal API tokens (see its `MODULE.md`): their creation, list and
 * revocation by a session, and their introspection by the gateway.
 */
@Module({
  imports: [MembershipsModule],
  controllers: [ApiTokenIntrospectionController, ApiTokensController],
  providers,
})
export class ApiTokensModule {}
