import type { FactoryProvider } from '@nestjs/common';
import { IntrospectToken } from '../../../../application/use-cases/commands/session/introspect-token/introspect-token.use-case.js';
import type { SessionsUnitOfWork } from '../../../../application/ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { SessionTokens } from '../../../../application/ports/outbound/security/session/session-tokens.port.js';
import type { Clock } from '../../../../application/ports/outbound/time/session/clock.port.js';
import { UNIT_OF_WORK } from '../../../tokens/session/unit-of-work.token.js';
import { SESSION_TOKENS } from '../../../tokens/session/session-tokens.token.js';
import { CLOCK } from '../../../tokens/session/clock.token.js';

/**
 * Constant introspectTokenProvider
 *
 * @description
 * Builds token introspection with access to the session transaction and clock.
 *
 * @type {FactoryProvider<IntrospectToken>}
 */
export const introspectTokenProvider: FactoryProvider<IntrospectToken> = {
  provide: IntrospectToken,
  inject: [UNIT_OF_WORK, SESSION_TOKENS, CLOCK],
  useFactory: (
    unitOfWork: SessionsUnitOfWork,
    sessionTokens: SessionTokens,
    systemClock: Clock,
  ): IntrospectToken => new IntrospectToken(unitOfWork, sessionTokens, systemClock),
};
