import type { FactoryProvider } from '@nestjs/common';

import type { SessionsUnitOfWork } from '../../../../application/ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import { EraseUserSessions } from '../../../../application/use-cases/commands/session/erase-user-sessions/erase-user-sessions.use-case.js';
import { UNIT_OF_WORK } from '../../../tokens/session/unit-of-work.token.js';

/**
 * Constant eraseUserSessionsProvider
 *
 * @description
 * Builds the erasure of the sessions of a deleted account, in the system transaction of its caller.
 *
 * @type {FactoryProvider<EraseUserSessions>}
 */
export const eraseUserSessionsProvider: FactoryProvider<EraseUserSessions> = {
  provide: EraseUserSessions,
  inject: [UNIT_OF_WORK],
  useFactory: (unitOfWork: SessionsUnitOfWork): EraseUserSessions =>
    new EraseUserSessions(unitOfWork),
};
