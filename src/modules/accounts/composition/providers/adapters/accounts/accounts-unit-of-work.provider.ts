import { SystemTransactionRunner } from '@cadenway/nest-common/database';
import { JobProducer } from '@cadenway/nest-jobs/runtime';
import { OutboxRelay, OutboxWriter } from '@cadenway/nest-messaging/outbox';
import type { FactoryProvider } from '@nestjs/common';

import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { FederatedFinishStore } from '../../../../application/ports/outbound/transactions/federation/federated-finish-store.port.js';
import { SystemAccountsUnitOfWork } from '../../../../infrastructure/persistence/drizzle/transactions/accounts/system-accounts.unit-of-work.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';
import { FEDERATED_SIGN_IN_AUTHORITY } from '../../../tokens/federated-sign-in/federated-sign-in-authority.token.js';

/**
 * Constant accountsUnitOfWorkProvider
 *
 * @description
 * Binds the AccountsUnitOfWork port to the Accounts adapter used at runtime.
 *
 * @type {FactoryProvider<AccountsUnitOfWork>}
 */
export const accountsUnitOfWorkProvider: FactoryProvider<AccountsUnitOfWork> = {
  provide: UNIT_OF_WORK,
  inject: [
    SystemTransactionRunner,
    OutboxWriter,
    OutboxRelay,
    JobProducer,
    FEDERATED_SIGN_IN_AUTHORITY,
  ],
  useFactory: (
    runner: SystemTransactionRunner,
    outbox: OutboxWriter,
    relay: OutboxRelay,
    jobs: JobProducer,
    federation: Pick<FederatedFinishStore, 'isAllowed' | 'activeMembershipId'>,
  ): AccountsUnitOfWork => new SystemAccountsUnitOfWork(runner, outbox, relay, jobs, federation),
};
