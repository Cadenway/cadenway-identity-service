import type { FactoryProvider } from '@nestjs/common';

import type { SessionsUnitOfWork } from '../../../../application/ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { Clock } from '../../../../application/ports/outbound/time/session/clock.port.js';
import { RevokeUserSessions } from '../../../../application/use-cases/commands/session/revoke-user-sessions/revoke-user-sessions.use-case.js';
import { CLOCK } from '../../../tokens/session/clock.token.js';
import { UNIT_OF_WORK } from '../../../tokens/session/unit-of-work.token.js';

/**
 * Constant revokeUserSessionsProvider
 *
 * @description
 * Builds the revocation of the sessions of a person, with their events, in the system transaction of its caller.
 *
 * @type {FactoryProvider<RevokeUserSessions>}
 */
export const revokeUserSessionsProvider: FactoryProvider<RevokeUserSessions> = {
  provide: RevokeUserSessions,
  inject: [UNIT_OF_WORK, CLOCK],
  useFactory: (unitOfWork: SessionsUnitOfWork, clock: Clock): RevokeUserSessions =>
    new RevokeUserSessions(unitOfWork, clock),
};
