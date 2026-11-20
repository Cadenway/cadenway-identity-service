import { SystemTransactionRunner } from '@cadenway/nest-common/database';
import { JobScheduler, JobWorkerRegistry } from '@cadenway/nest-jobs/runtime';
import { OutboxRelay, OutboxWriter } from '@cadenway/nest-messaging/outbox';
import type { FactoryProvider } from '@nestjs/common';

import {
  AVATAR_UPLOAD_EXPIRY_CRON,
  AVATAR_UPLOAD_EXPIRY_QUEUE,
} from '../../../../../../config/job-queues.js';
import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import type { AvatarUnitOfWork } from '../../../../application/ports/outbound/transactions/avatar/avatar-unit-of-work.port.js';
import { AbandonAvatarUpload } from '../../../../application/use-cases/commands/avatar/abandon-avatar-upload/abandon-avatar-upload.use-case.js';
import { PublishAvatar } from '../../../../application/use-cases/commands/avatar/publish-avatar/publish-avatar.use-case.js';
import { RemoveAvatar } from '../../../../application/use-cases/commands/avatar/remove-avatar/remove-avatar.use-case.js';
import { ReserveAvatarUpload } from '../../../../application/use-cases/commands/avatar/reserve-avatar-upload/reserve-avatar-upload.use-case.js';
import { GetAvatarReference } from '../../../../application/use-cases/queries/avatar/get-avatar-reference/get-avatar-reference.use-case.js';
import { GetAvatarUpload } from '../../../../application/use-cases/queries/avatar/get-avatar-upload/get-avatar-upload.use-case.js';
import { SystemAvatarUnitOfWork } from '../../../../infrastructure/persistence/drizzle/transactions/avatar/system-avatar.unit-of-work.js';
import { AvatarUploadExpiryHandler } from '../../../../presentation/jobs/handlers/avatar/avatar-upload-expiry.handler.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';

function withClock<T extends object>(
  operation: new (work: AvatarUnitOfWork, now: () => Date) => T,
): FactoryProvider<T> {
  return {
    provide: operation,
    inject: [SystemAvatarUnitOfWork, CLOCK],
    useFactory: (work: AvatarUnitOfWork, clock: Clock): T => new operation(work, () => clock.now()),
  };
}

function withWork<T extends object>(
  operation: new (work: AvatarUnitOfWork) => T,
): FactoryProvider<T> {
  return {
    provide: operation,
    inject: [SystemAvatarUnitOfWork],
    useFactory: (work: AvatarUnitOfWork): T => new operation(work),
  };
}

/** Composes avatar operations, transactional outbox and the expiration schedule. */
export const avatarProviders: readonly FactoryProvider[] = [
  {
    provide: SystemAvatarUnitOfWork,
    inject: [SystemTransactionRunner, OutboxWriter, OutboxRelay],
    useFactory: (runner: SystemTransactionRunner, outbox: OutboxWriter, relay: OutboxRelay) =>
      new SystemAvatarUnitOfWork(runner, outbox, relay),
  },
  withClock(ReserveAvatarUpload),
  withClock(GetAvatarUpload),
  withClock(PublishAvatar),
  withClock(AbandonAvatarUpload),
  withWork(RemoveAvatar),
  withWork(GetAvatarReference),
  {
    provide: AvatarUploadExpiryHandler,
    inject: [JobScheduler, JobWorkerRegistry, SystemAvatarUnitOfWork, AbandonAvatarUpload, CLOCK],
    useFactory: (
      scheduler: JobScheduler,
      workers: JobWorkerRegistry,
      work: SystemAvatarUnitOfWork,
      abandon: AbandonAvatarUpload,
      clock: Clock,
    ) =>
      new AvatarUploadExpiryHandler(
        scheduler,
        workers,
        (limit) => work.findExpired(clock.now(), limit),
        abandon,
        AVATAR_UPLOAD_EXPIRY_QUEUE,
        AVATAR_UPLOAD_EXPIRY_CRON,
      ),
  },
];
