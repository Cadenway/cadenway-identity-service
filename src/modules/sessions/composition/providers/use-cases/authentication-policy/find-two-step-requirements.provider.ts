import type { FactoryProvider } from '@nestjs/common';

import type { ActiveMemberships } from '../../../../application/ports/outbound/memberships/session/active-memberships.port.js';
import type { SessionsUnitOfWork } from '../../../../application/ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import { FindTwoStepRequirements } from '../../../../application/use-cases/queries/authentication-policy/find-two-step-requirements/find-two-step-requirements.use-case.js';
import { ACTIVE_MEMBERSHIPS } from '../../../tokens/session/active-memberships.token.js';
import { UNIT_OF_WORK } from '../../../tokens/session/unit-of-work.token.js';

/**
 * Constant findTwoStepRequirementsProvider
 *
 * @description
 * Builds `FindTwoStepRequirements` on the system unit of work, which joins the transaction of its caller.
 *
 * @type {FactoryProvider<FindTwoStepRequirements>}
 */
export const findTwoStepRequirementsProvider: FactoryProvider<FindTwoStepRequirements> = {
  provide: FindTwoStepRequirements,
  inject: [UNIT_OF_WORK, ACTIVE_MEMBERSHIPS],
  useFactory: (
    unitOfWork: SessionsUnitOfWork,
    memberships: ActiveMemberships,
  ): FindTwoStepRequirements => new FindTwoStepRequirements(unitOfWork, memberships),
};
