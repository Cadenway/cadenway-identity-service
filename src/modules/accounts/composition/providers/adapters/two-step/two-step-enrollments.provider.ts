import type { FactoryProvider } from '@nestjs/common';

import { RecordTwoStepVerification } from '../../../../../sessions/public/session/record-two-step-verification.js';
import type { TwoStepEnrollments } from '../../../../application/ports/outbound/identity/sessions/two-step-enrollments.port.js';
import { TWO_STEP_ENROLLMENTS } from '../../../tokens/two-step/two-step-enrollments.token.js';

/**
 * Constant twoStepEnrollmentsProvider
 *
 * @description
 * Binds `TwoStepEnrollments` to `RecordTwoStepVerification` of the sessions module, which joins
 * the system transaction of the accounts module.
 *
 * @type {FactoryProvider<TwoStepEnrollments>}
 */
export const twoStepEnrollmentsProvider: FactoryProvider<TwoStepEnrollments> = {
  provide: TWO_STEP_ENROLLMENTS,
  inject: [RecordTwoStepVerification],
  useFactory: (recordTwoStepVerification: RecordTwoStepVerification): TwoStepEnrollments => ({
    record: (userId: string, enabled: boolean): Promise<void> =>
      recordTwoStepVerification.execute({ userId, enabled }),
  }),
};
