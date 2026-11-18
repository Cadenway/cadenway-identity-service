import type { FactoryProvider } from '@nestjs/common';

import type { SessionsUnitOfWork } from '../../../../application/ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import { CheckOrganizationAccess } from '../../../../application/use-cases/queries/authentication-policy/check-organization-access/check-organization-access.use-case.js';
import { UNIT_OF_WORK } from '../../../tokens/session/unit-of-work.token.js';

/**
 * Constant checkOrganizationAccessProvider
 *
 * @description
 * Builds `CheckOrganizationAccess` on the system unit of work, which joins the transaction of the introspection of a personal API token.
 *
 * @type {FactoryProvider<CheckOrganizationAccess>}
 */
export const checkOrganizationAccessProvider: FactoryProvider<CheckOrganizationAccess> = {
  provide: CheckOrganizationAccess,
  inject: [UNIT_OF_WORK],
  useFactory: (unitOfWork: SessionsUnitOfWork): CheckOrganizationAccess =>
    new CheckOrganizationAccess(unitOfWork),
};
