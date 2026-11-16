import type { FactoryProvider } from '@nestjs/common';
import { SystemTransactionRunner } from '@cadenway/nest-common/database';
import { OutboxRelay, OutboxWriter } from '@cadenway/nest-messaging/outbox';
import { SystemSessionsUnitOfWork } from '../../../../infrastructure/persistence/drizzle/transactions/session/system-sessions.unit-of-work.js';
import type { SessionsUnitOfWork } from '../../../../application/ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import { UNIT_OF_WORK } from '../../../tokens/session/unit-of-work.token.js';

/**
 * Constant sessionsUnitOfWorkProvider
 *
 * @description
 * Provides one transaction scope for the session state and outbox.
 *
 * @type {FactoryProvider<SessionsUnitOfWork>}
 */
export const sessionsUnitOfWorkProvider: FactoryProvider<SessionsUnitOfWork> = {
  provide: UNIT_OF_WORK,
  inject: [SystemTransactionRunner, OutboxWriter, OutboxRelay],
  useFactory: (
    runner: SystemTransactionRunner,
    outbox: OutboxWriter,
    relay: OutboxRelay,
  ): SessionsUnitOfWork => new SystemSessionsUnitOfWork(runner, outbox, relay),
};
