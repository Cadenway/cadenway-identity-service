import { eventSchemas } from '@cadenway/contracts/events/identity-service';
import type { TransactionScope } from '@cadenway/nest-common/database';
import type { OutboxWriter } from '@cadenway/nest-messaging/outbox';

import type { AvatarChanged } from '../../../../domain/events/avatar/avatar-changed.event.js';
import type { AvatarUploadAbandoned } from '../../../../domain/events/avatar/avatar-upload-abandoned.event.js';

/** Records opaque account and asset references in the owner transaction. */
export class OutboxAvatarEvents {
  // #region Constructor
  /** Binds the outbox writer and the active owner transaction. */
  public constructor(
    private readonly transaction: TransactionScope,
    private readonly outbox: Pick<OutboxWriter, 'append'>,
  ) {}
  // #endregion

  // #region Methods
  /** Appends one actual avatar change, ordered by the private generation. */
  public async appendChanged(event: AvatarChanged): Promise<void> {
    await this.outbox.append(this.transaction, eventSchemas, 'user.avatar-changed.v1', {
      organizationId: null,
      actor: { type: 'user', id: event.userId },
      version: event.generation,
      userId: event.userId,
      assetId: event.assetId,
      oldAssetId: event.oldAssetId,
    });
  }

  /** Appends the terminal abandonment of one unused upload. */
  public async appendAbandoned(event: AvatarUploadAbandoned): Promise<void> {
    await this.outbox.append(this.transaction, eventSchemas, 'user.avatar-upload-abandoned.v1', {
      organizationId: null,
      actor: { type: 'system', id: 'identity-service' },
      version: 1,
      userId: event.userId,
      uploadId: event.uploadId,
    });
  }
  // #endregion
}
