import { SystemTransactionRunner } from '@cadenway/nest-common/database';
import type { FactoryProvider } from '@nestjs/common';

import { PurgeExpiredFederation } from '../../../../application/use-cases/commands/federated-sign-in/purge-expired-federation/purge-expired-federation.use-case.js';
import { SystemExpiredFederationUnitOfWork } from '../../../../infrastructure/persistence/drizzle/transactions/federated-sign-in/system-expired-federation.unit-of-work.js';

/** Builds the federation retention use case with Identity's system transaction runner. */
export const purgeExpiredFederationProvider: FactoryProvider<PurgeExpiredFederation> = {
  provide: PurgeExpiredFederation,
  inject: [SystemTransactionRunner],
  useFactory: (runner: SystemTransactionRunner): PurgeExpiredFederation =>
    new PurgeExpiredFederation(new SystemExpiredFederationUnitOfWork(runner)),
};
