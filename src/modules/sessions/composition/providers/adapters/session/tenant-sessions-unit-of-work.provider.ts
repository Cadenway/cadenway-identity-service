import { TenantTransactionRunner } from '@cadenway/nest-common/database';
import { OutboxRelay, OutboxWriter } from '@cadenway/nest-messaging/outbox';
import type { FactoryProvider } from '@nestjs/common';

import type { SessionsUnitOfWork } from '../../../../application/ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import { TenantSessionsUnitOfWork } from '../../../../infrastructure/persistence/drizzle/transactions/session/tenant-sessions.unit-of-work.js';
import { TENANT_UNIT_OF_WORK } from '../../../tokens/session/tenant-unit-of-work.token.js';

/**
 * Constant tenantSessionsUnitOfWorkProvider
 *
 * @description
 * Provides the tenant transaction scope of the sessions, joined by the check of the creation of a
 * personal API token.
 *
 * @type {FactoryProvider<SessionsUnitOfWork>}
 */
export const tenantSessionsUnitOfWorkProvider: FactoryProvider<SessionsUnitOfWork> = {
  provide: TENANT_UNIT_OF_WORK,
  inject: [TenantTransactionRunner, OutboxWriter, OutboxRelay],
  useFactory: (
    runner: TenantTransactionRunner,
    outbox: OutboxWriter,
    relay: OutboxRelay,
  ): SessionsUnitOfWork => new TenantSessionsUnitOfWork(runner, outbox, relay),
};
