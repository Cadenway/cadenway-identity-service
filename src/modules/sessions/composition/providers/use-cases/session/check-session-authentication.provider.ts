import type { FactoryProvider } from '@nestjs/common';

import type { SessionsUnitOfWork } from '../../../../application/ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { Clock } from '../../../../application/ports/outbound/time/session/clock.port.js';
import { CheckSessionAuthentication } from '../../../../application/use-cases/queries/session/check-session-authentication/check-session-authentication.use-case.js';
import { CLOCK } from '../../../tokens/session/clock.token.js';
import { UNIT_OF_WORK } from '../../../tokens/session/unit-of-work.token.js';

/**
 * Constant checkSessionAuthenticationProvider
 *
 * @description
 * Builds the check of the recent authentication of a session, in the system transaction of its caller.
 *
 * @type {FactoryProvider<CheckSessionAuthentication>}
 */
export const checkSessionAuthenticationProvider: FactoryProvider<CheckSessionAuthentication> = {
  provide: CheckSessionAuthentication,
  inject: [UNIT_OF_WORK, CLOCK],
  useFactory: (unitOfWork: SessionsUnitOfWork, clock: Clock): CheckSessionAuthentication =>
    new CheckSessionAuthentication(unitOfWork, clock),
};
