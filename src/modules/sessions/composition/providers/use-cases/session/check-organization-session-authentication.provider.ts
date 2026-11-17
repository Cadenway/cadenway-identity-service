import type { FactoryProvider } from '@nestjs/common';

import type { SessionsUnitOfWork } from '../../../../application/ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { Clock } from '../../../../application/ports/outbound/time/session/clock.port.js';
import { CheckOrganizationSessionAuthentication } from '../../../../application/use-cases/queries/session/check-organization-session-authentication/check-organization-session-authentication.use-case.js';
import { CLOCK } from '../../../tokens/session/clock.token.js';
import { TENANT_UNIT_OF_WORK } from '../../../tokens/session/tenant-unit-of-work.token.js';

/**
 * Constant checkOrganizationSessionAuthenticationProvider
 *
 * @description
 * Builds the check of the recent authentication of a session, in the tenant transaction of the request.
 *
 * @type {FactoryProvider<CheckOrganizationSessionAuthentication>}
 */
export const checkOrganizationSessionAuthenticationProvider: FactoryProvider<CheckOrganizationSessionAuthentication> =
  {
    provide: CheckOrganizationSessionAuthentication,
    inject: [TENANT_UNIT_OF_WORK, CLOCK],
    useFactory: (
      unitOfWork: SessionsUnitOfWork,
      clock: Clock,
    ): CheckOrganizationSessionAuthentication =>
      new CheckOrganizationSessionAuthentication(unitOfWork, clock),
  };
