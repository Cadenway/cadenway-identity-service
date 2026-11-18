import type { FactoryProvider } from '@nestjs/common';

import type { SessionsUnitOfWork } from '../../../../application/ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { Clock } from '../../../../application/ports/outbound/time/session/clock.port.js';
import { CountOpenSessions } from '../../../../application/use-cases/queries/session/count-open-sessions/count-open-sessions.use-case.js';
import { CLOCK } from '../../../tokens/session/clock.token.js';
import { UNIT_OF_WORK } from '../../../tokens/session/unit-of-work.token.js';

/**
 * Constant countOpenSessionsProvider
 *
 * @description
 * Builds the count of the open sessions of an account, in the system transaction of its caller.
 *
 * @type {FactoryProvider<CountOpenSessions>}
 */
export const countOpenSessionsProvider: FactoryProvider<CountOpenSessions> = {
  provide: CountOpenSessions,
  inject: [UNIT_OF_WORK, CLOCK],
  useFactory: (unitOfWork: SessionsUnitOfWork, clock: Clock): CountOpenSessions =>
    new CountOpenSessions(unitOfWork, clock),
};
