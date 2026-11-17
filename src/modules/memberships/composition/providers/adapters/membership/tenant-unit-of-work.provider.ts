import { TenantTransactionRunner } from '@cadenway/nest-common/database';
import type { FactoryProvider } from '@nestjs/common';

import type { MembershipsUnitOfWork } from '../../../../application/ports/outbound/transactions/membership/memberships-unit-of-work.port.js';
import { TenantMembershipsUnitOfWork } from '../../../../infrastructure/persistence/drizzle/transactions/membership/tenant-memberships.unit-of-work.js';
import { TENANT_UNIT_OF_WORK } from '../../../tokens/membership/tenant-unit-of-work.token.js';

/**
 * Constant tenantUnitOfWorkProvider
 *
 * @description
 * Binds the unit of work of the member event handlers to the tenant runner of the kit.
 *
 * @type {FactoryProvider<MembershipsUnitOfWork>}
 */
export const tenantUnitOfWorkProvider: FactoryProvider<MembershipsUnitOfWork> = {
  provide: TENANT_UNIT_OF_WORK,
  inject: [TenantTransactionRunner],
  useFactory: (runner: TenantTransactionRunner): MembershipsUnitOfWork =>
    new TenantMembershipsUnitOfWork(runner),
};
