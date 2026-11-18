import type { FactoryProvider } from '@nestjs/common';

import { FindTwoStepRequirements } from '../../../../../sessions/public/authentication-policy/find-two-step-requirements.js';
import type { FindTwoStepRequirementsOutput } from '../../../../../sessions/public/authentication-policy/find-two-step-requirements.js';
import type { TwoStepRequirement } from '../../../../application/models/two-step/two-step-requirement.model.js';
import type { TwoStepRequirements } from '../../../../application/ports/outbound/identity/sessions/two-step-requirements.port.js';
import { TWO_STEP_REQUIREMENTS } from '../../../tokens/two-step/two-step-requirements.token.js';

/**
 * Constant twoStepRequirementsProvider
 *
 * @description
 * Binds `TwoStepRequirements` to `FindTwoStepRequirements` of the sessions module, which reads
 * the policies and the copy of the memberships in the system transaction of the accounts module.
 *
 * @type {FactoryProvider<TwoStepRequirements>}
 */
export const twoStepRequirementsProvider: FactoryProvider<TwoStepRequirements> = {
  provide: TWO_STEP_REQUIREMENTS,
  inject: [FindTwoStepRequirements],
  useFactory: (findTwoStepRequirements: FindTwoStepRequirements): TwoStepRequirements => ({
    of: async (userId: string): Promise<readonly TwoStepRequirement[]> => {
      const found: FindTwoStepRequirementsOutput = await findTwoStepRequirements.execute({
        userId,
      });
      return found.requirements;
    },
  }),
};
