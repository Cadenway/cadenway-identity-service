import type { FactoryProvider } from '@nestjs/common';

import type { Clock } from '../../../../application/ports/outbound/time/session/clock.port.js';
import type { SessionsUnitOfWork } from '../../../../application/ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import { RecordTwoStepVerification } from '../../../../application/use-cases/commands/session/record-two-step-verification/record-two-step-verification.use-case.js';
import { CLOCK } from '../../../tokens/session/clock.token.js';
import { UNIT_OF_WORK } from '../../../tokens/session/unit-of-work.token.js';

/**
 * Constant recordTwoStepVerificationProvider
 *
 * @description
 * Builds `RecordTwoStepVerification` on the system unit of work, which joins the transaction of the accounts module that turns two-step verification on or off.
 *
 * @type {FactoryProvider<RecordTwoStepVerification>}
 */
export const recordTwoStepVerificationProvider: FactoryProvider<RecordTwoStepVerification> = {
  provide: RecordTwoStepVerification,
  inject: [UNIT_OF_WORK, CLOCK],
  useFactory: (unitOfWork: SessionsUnitOfWork, clock: Clock): RecordTwoStepVerification =>
    new RecordTwoStepVerification(unitOfWork, clock),
};
