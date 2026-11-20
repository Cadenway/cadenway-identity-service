import { AvatarUpload } from '../../../../../domain/aggregates/avatar-upload/avatar-upload.aggregate.js';
import type { AvatarReservation } from '../../../../models/avatar/avatar-reservation.model.js';
import type { AvatarUnitOfWork } from '../../../../ports/outbound/transactions/avatar/avatar-unit-of-work.port.js';
import { lockAvatarOwner } from '../../../../services/avatar/avatar-owner.service.js';
import type { ReserveAvatarUploadInput } from './reserve-avatar-upload.input.js';

/** Reserves an upload once for the current account generation. */
export class ReserveAvatarUpload {
  // #region Constructor
  /** Binds the account transaction and operation dependencies. */
  public constructor(
    private readonly work: AvatarUnitOfWork,
    private readonly now: () => Date,
  ) {}
  // #endregion

  // #region Methods
  /** Runs the account avatar operation. */
  public execute(input: ReserveAvatarUploadInput): Promise<AvatarReservation> {
    return this.work.run(async (store) => {
      const user = await lockAvatarOwner(store, input);
      const previous =
        input.idempotencyKey === undefined
          ? null
          : await store.findByIdempotencyKey(user.id, input.idempotencyKey);
      if (previous !== null) {
        previous.assertEquivalent(user.id, input);
        return { uploadId: previous.snapshot.id, expiresAt: previous.snapshot.expiresAt };
      }
      const upload = AvatarUpload.reserve({
        id: await store.newUploadId(),
        userId: user.id,
        generation: user.avatarGeneration,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        now: this.now(),
      });
      await store.insertUpload(upload, input.idempotencyKey);
      return { uploadId: upload.snapshot.id, expiresAt: upload.snapshot.expiresAt };
    });
  }
  // #endregion
}
