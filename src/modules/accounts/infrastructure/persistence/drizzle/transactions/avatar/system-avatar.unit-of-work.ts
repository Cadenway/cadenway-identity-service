import type { SystemTransactionRunner } from '@cadenway/nest-common/database';
import type { OutboxRelay, OutboxWriter } from '@cadenway/nest-messaging/outbox';

import type { AvatarStore } from '../../../../../application/ports/outbound/transactions/avatar/avatar-store.port.js';
import type { AvatarUnitOfWork } from '../../../../../application/ports/outbound/transactions/avatar/avatar-unit-of-work.port.js';
import type { AbandonAvatarUploadInput } from '../../../../../application/use-cases/commands/avatar/abandon-avatar-upload/abandon-avatar-upload.input.js';
import { OutboxAvatarEvents } from '../../../../messaging/outbox/avatar/outbox-avatar-events.adapter.js';
import { DrizzleAvatarRepository } from '../../repositories/avatar/drizzle-avatar.repository.js';

/** Keeps account-owned avatar data and facts in one system transaction. */
export class SystemAvatarUnitOfWork implements AvatarUnitOfWork {
  // #region Constructor
  /** Takes the system runner and outbox facade of Identity. */
  public constructor(
    private readonly runner: SystemTransactionRunner,
    private readonly outbox: OutboxWriter,
    private readonly relay: OutboxRelay,
  ) {}
  // #endregion

  // #region Methods
  /** Wakes the relay only after a committed decision appended events. */
  public async run<T>(
    work: (store: AvatarStore) => Promise<T>,
    options?: { readonly readOnly: boolean },
  ): Promise<T> {
    const outboxState = { appended: false };
    const result = await this.runner.run(
      (transaction) => {
        const repository = new DrizzleAvatarRepository(transaction.db);
        const events = new OutboxAvatarEvents(transaction, this.outbox);
        return work({
          lockUser: repository.lockUser.bind(repository),
          findUser: repository.findUser.bind(repository),
          findUpload: repository.findUpload.bind(repository),
          lockUpload: repository.lockUpload.bind(repository),
          findByIdempotencyKey: repository.findByIdempotencyKey.bind(repository),
          newUploadId: repository.newUploadId.bind(repository),
          insertUpload: repository.insertUpload.bind(repository),
          saveUpload: repository.saveUpload.bind(repository),
          saveAvatar: repository.saveAvatar.bind(repository),
          async appendChanged(event) {
            await events.appendChanged(event);
            outboxState.appended = true;
          },
          async appendAbandoned(event) {
            await events.appendAbandoned(event);
            outboxState.appended = true;
          },
        });
      },
      { readOnly: options?.readOnly ?? false },
    );
    if (outboxState.appended) this.relay.wake();
    return result;
  }

  /** Lists only expired owner and upload keys, then releases the scan transaction. */
  public findExpired(now: Date, limit: number): Promise<readonly AbandonAvatarUploadInput[]> {
    return this.runner.run(({ db }) => new DrizzleAvatarRepository(db).findExpired(now, limit), {
      readOnly: true,
    });
  }
  // #endregion
}
