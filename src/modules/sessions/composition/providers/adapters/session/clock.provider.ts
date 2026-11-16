import type { FactoryProvider } from '@nestjs/common';
import { SystemClock } from '../../../../../../infrastructure/system-clock.js';
import type { Clock } from '../../../../application/ports/outbound/time/session/clock.port.js';
import { CLOCK } from '../../../tokens/session/clock.token.js';

/**
 * Constant sessionClockProvider
 *
 * @description
 * Supplies wall-clock time to session operations.
 *
 * @type {FactoryProvider<Clock>}
 */
export const sessionClockProvider: FactoryProvider<Clock> = {
  provide: CLOCK,
  useFactory: (): Clock => new SystemClock(),
};
