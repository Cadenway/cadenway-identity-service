import type { FactoryProvider } from '@nestjs/common';
import { OpenSession } from '../../../../application/use-cases/commands/session/open-session/open-session.use-case.js';
import type { SessionsUnitOfWork } from '../../../../application/ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { SessionTokens } from '../../../../application/ports/outbound/security/session/session-tokens.port.js';
import type { DeviceReader } from '../../../../application/ports/outbound/device/session/device-reader.port.js';
import type { Clock } from '../../../../application/ports/outbound/time/session/clock.port.js';
import { UNIT_OF_WORK } from '../../../tokens/session/unit-of-work.token.js';
import { SESSION_TOKENS } from '../../../tokens/session/session-tokens.token.js';
import { DEVICE_READER } from '../../../tokens/session/device-reader.token.js';
import { CLOCK } from '../../../tokens/session/clock.token.js';

/**
 * Constant openSessionProvider
 *
 * @description
 * Builds the public session-opening operation using the system transaction runner.
 *
 * @type {FactoryProvider<OpenSession>}
 */
export const openSessionProvider: FactoryProvider<OpenSession> = {
  provide: OpenSession,
  inject: [UNIT_OF_WORK, SESSION_TOKENS, DEVICE_READER, CLOCK],
  useFactory: (
    unitOfWork: SessionsUnitOfWork,
    sessionTokens: SessionTokens,
    devices: DeviceReader,
    systemClock: Clock,
  ): OpenSession => new OpenSession(unitOfWork, sessionTokens, devices, systemClock),
};
