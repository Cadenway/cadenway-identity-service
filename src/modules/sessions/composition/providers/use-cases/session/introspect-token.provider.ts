import type { FactoryProvider } from '@nestjs/common';
import { FindAuthoritativeMembership } from '../../../../../memberships/public/membership/find-authoritative-membership.js';
import { IntrospectToken } from '../../../../application/use-cases/commands/session/introspect-token/introspect-token.use-case.js';
import type { SessionsUnitOfWork } from '../../../../application/ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { SessionTokens } from '../../../../application/ports/outbound/security/session/session-tokens.port.js';
import type { Clock } from '../../../../application/ports/outbound/time/session/clock.port.js';
import type { ActiveMemberships } from '../../../../application/ports/outbound/memberships/session/active-memberships.port.js';
import { ACTIVE_MEMBERSHIPS } from '../../../tokens/session/active-memberships.token.js';
import { UNIT_OF_WORK } from '../../../tokens/session/unit-of-work.token.js';
import { SESSION_TOKENS } from '../../../tokens/session/session-tokens.token.js';
import { CLOCK } from '../../../tokens/session/clock.token.js';

/**
 * Constant introspectTokenProvider
 *
 * @description
 * Builds token introspection with the active membership authority and legacy projection.
 *
 * @type {FactoryProvider<IntrospectToken>}
 */
export const introspectTokenProvider: FactoryProvider<IntrospectToken> = {
  provide: IntrospectToken,
  inject: [UNIT_OF_WORK, SESSION_TOKENS, ACTIVE_MEMBERSHIPS, CLOCK, FindAuthoritativeMembership],
  useFactory: (
    unitOfWork: SessionsUnitOfWork,
    sessionTokens: SessionTokens,
    memberships: ActiveMemberships,
    systemClock: Clock,
    authority: FindAuthoritativeMembership | null,
  ): IntrospectToken =>
    new IntrospectToken(
      unitOfWork,
      sessionTokens,
      memberships,
      systemClock,
      authority === null
        ? null
        : { find: (organizationId, userId) => authority.execute({ organizationId, userId }) },
    ),
};
