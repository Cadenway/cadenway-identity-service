import type { FactoryProvider } from '@nestjs/common';

import type { SessionsUnitOfWork } from '../../../../application/ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { Clock } from '../../../../application/ports/outbound/time/session/clock.port.js';
import { RevokeOtherSessions } from '../../../../application/use-cases/commands/session/revoke-other-sessions/revoke-other-sessions.use-case.js';
import { CLOCK } from '../../../tokens/session/clock.token.js';
import { UNIT_OF_WORK } from '../../../tokens/session/unit-of-work.token.js';

/**
 * Constant revokeOtherSessionsProvider
 *
 * @description
 * Builds the revocation of the other sessions of the request, with their events.
 *
 * @type {FactoryProvider<RevokeOtherSessions>}
 */
export const revokeOtherSessionsProvider: FactoryProvider<RevokeOtherSessions> = {
  provide: RevokeOtherSessions,
  inject: [UNIT_OF_WORK, CLOCK],
  useFactory: (unitOfWork: SessionsUnitOfWork, clock: Clock): RevokeOtherSessions =>
    new RevokeOtherSessions(unitOfWork, clock),
};
