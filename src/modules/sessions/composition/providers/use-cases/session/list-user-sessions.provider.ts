import type { FactoryProvider } from '@nestjs/common';

import type { SessionsUnitOfWork } from '../../../../application/ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { DeviceReader } from '../../../../application/ports/outbound/device/session/device-reader.port.js';
import type { Clock } from '../../../../application/ports/outbound/time/session/clock.port.js';
import { ListUserSessions } from '../../../../application/use-cases/queries/session/list-user-sessions/list-user-sessions.use-case.js';
import { CLOCK } from '../../../tokens/session/clock.token.js';
import { DEVICE_READER } from '../../../tokens/session/device-reader.token.js';
import { UNIT_OF_WORK } from '../../../tokens/session/unit-of-work.token.js';

/**
 * Constant listUserSessionsProvider
 *
 * @description
 * Builds the list of the open sessions of the actor, with their devices.
 *
 * @type {FactoryProvider<ListUserSessions>}
 */
export const listUserSessionsProvider: FactoryProvider<ListUserSessions> = {
  provide: ListUserSessions,
  inject: [UNIT_OF_WORK, DEVICE_READER, CLOCK],
  useFactory: (
    unitOfWork: SessionsUnitOfWork,
    devices: DeviceReader,
    clock: Clock,
  ): ListUserSessions => new ListUserSessions(unitOfWork, devices, clock),
};
