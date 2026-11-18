import type { FactoryProvider } from '@nestjs/common';

import type { SessionsUnitOfWork } from '../../../../application/ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { Clock } from '../../../../application/ports/outbound/time/session/clock.port.js';
import { EndRecentAuthentication } from '../../../../application/use-cases/commands/session/end-recent-authentication/end-recent-authentication.use-case.js';
import { CLOCK } from '../../../tokens/session/clock.token.js';
import { UNIT_OF_WORK } from '../../../tokens/session/unit-of-work.token.js';

/**
 * Constant endRecentAuthenticationProvider
 *
 * @description
 * Builds the end of the recent authentication of the sessions, in the system transaction of its caller.
 *
 * @type {FactoryProvider<EndRecentAuthentication>}
 */
export const endRecentAuthenticationProvider: FactoryProvider<EndRecentAuthentication> = {
  provide: EndRecentAuthentication,
  inject: [UNIT_OF_WORK, CLOCK],
  useFactory: (unitOfWork: SessionsUnitOfWork, clock: Clock): EndRecentAuthentication =>
    new EndRecentAuthentication(unitOfWork, clock),
};
