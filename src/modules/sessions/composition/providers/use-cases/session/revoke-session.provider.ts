import type { FactoryProvider } from '@nestjs/common';
import { RevokeSession } from '../../../../application/use-cases/commands/session/revoke-session/revoke-session.use-case.js';
import type { SessionsUnitOfWork } from '../../../../application/ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { Clock } from '../../../../application/ports/outbound/time/session/clock.port.js';
import { UNIT_OF_WORK } from '../../../tokens/session/unit-of-work.token.js';
import { CLOCK } from '../../../tokens/session/clock.token.js';

/**
 * Constant revokeSessionProvider
 *
 * @description
 * Builds session revocation with the transaction that also records its event.
 *
 * @type {FactoryProvider<RevokeSession>}
 */
export const revokeSessionProvider: FactoryProvider<RevokeSession> = {
  provide: RevokeSession,
  inject: [UNIT_OF_WORK, CLOCK],
  useFactory: (unitOfWork: SessionsUnitOfWork, systemClock: Clock): RevokeSession =>
    new RevokeSession(unitOfWork, systemClock),
};
