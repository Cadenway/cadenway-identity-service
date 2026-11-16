import type { FactoryProvider } from '@nestjs/common';

import { SystemClock } from '../../../../../../infrastructure/system-clock.js';
import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';

/**
 * Constant clockProvider
 *
 * @description
 * Binds the Clock port to the Accounts adapter used at runtime.
 *
 * @type {FactoryProvider<Clock>}
 */
export const clockProvider: FactoryProvider<Clock> = {
  provide: CLOCK,
  useFactory: (): Clock => new SystemClock(),
};
