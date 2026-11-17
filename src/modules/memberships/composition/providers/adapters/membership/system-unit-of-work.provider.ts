import { SystemTransactionRunner } from '@cadenway/nest-common/database';
import type { FactoryProvider } from '@nestjs/common';

import type { MembershipsUnitOfWork } from '../../../../application/ports/outbound/transactions/membership/memberships-unit-of-work.port.js';
import { SystemMembershipsUnitOfWork } from '../../../../infrastructure/persistence/drizzle/transactions/membership/system-memberships.unit-of-work.js';
import { SYSTEM_UNIT_OF_WORK } from '../../../tokens/membership/system-unit-of-work.token.js';

/**
 * Constant systemUnitOfWorkProvider
 *
 * @description
 * Binds the unit of work of the reading other modules consume to the system runner of the kit.
 *
 * @type {FactoryProvider<MembershipsUnitOfWork>}
 */
export const systemUnitOfWorkProvider: FactoryProvider<MembershipsUnitOfWork> = {
  provide: SYSTEM_UNIT_OF_WORK,
  inject: [SystemTransactionRunner],
  useFactory: (runner: SystemTransactionRunner): MembershipsUnitOfWork =>
    new SystemMembershipsUnitOfWork(runner),
};
