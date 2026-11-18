import type { FactoryProvider } from '@nestjs/common';

import type { TwoStepRequirements } from '../../../../application/ports/outbound/identity/sessions/two-step-requirements.port.js';
import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { GetTwoStepVerification } from '../../../../application/use-cases/queries/two-step/get-two-step-verification/get-two-step-verification.use-case.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';
import { TWO_STEP_REQUIREMENTS } from '../../../tokens/two-step/two-step-requirements.token.js';

/**
 * Constant getTwoStepVerificationProvider
 *
 * @description
 * Builds `GetTwoStepVerification` on the system unit of work of the accounts module.
 *
 * @type {FactoryProvider<GetTwoStepVerification>}
 */
export const getTwoStepVerificationProvider: FactoryProvider<GetTwoStepVerification> = {
  provide: GetTwoStepVerification,
  inject: [UNIT_OF_WORK, TWO_STEP_REQUIREMENTS],
  useFactory: (
    unitOfWork: AccountsUnitOfWork,
    requirements: TwoStepRequirements,
  ): GetTwoStepVerification => new GetTwoStepVerification(unitOfWork, requirements),
};
