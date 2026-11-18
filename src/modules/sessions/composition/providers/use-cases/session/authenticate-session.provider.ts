import type { FactoryProvider } from '@nestjs/common';

import type { SessionsUnitOfWork } from '../../../../application/ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { Clock } from '../../../../application/ports/outbound/time/session/clock.port.js';
import { AuthenticateSession } from '../../../../application/use-cases/commands/session/authenticate-session/authenticate-session.use-case.js';
import { CLOCK } from '../../../tokens/session/clock.token.js';
import { UNIT_OF_WORK } from '../../../tokens/session/unit-of-work.token.js';

/**
 * Constant authenticateSessionProvider
 *
 * @description
 * Builds the recording of a recent authentication, in the system transaction of its caller.
 *
 * @type {FactoryProvider<AuthenticateSession>}
 */
export const authenticateSessionProvider: FactoryProvider<AuthenticateSession> = {
  provide: AuthenticateSession,
  inject: [UNIT_OF_WORK, CLOCK],
  useFactory: (unitOfWork: SessionsUnitOfWork, clock: Clock): AuthenticateSession =>
    new AuthenticateSession(unitOfWork, clock),
};
