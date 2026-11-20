import { AvatarRefusal } from '../../../../../domain/errors/avatar/avatar-refusal.error.js';
import type { AvatarUnitOfWork } from '../../../../ports/outbound/transactions/avatar/avatar-unit-of-work.port.js';
import { lockAvatarOwner } from '../../../../services/avatar/avatar-owner.service.js';
import type { GetAvatarUploadInput } from './get-avatar-upload.input.js';
import type { GetAvatarUploadOutput } from './get-avatar-upload.output.js';

/** Checks a reservation before Storage preparation. */
export class GetAvatarUpload {
  // #region Constructor
  /** Binds the account transaction and operation dependencies. */
  public constructor(
    private readonly work: AvatarUnitOfWork,
    private readonly now: () => Date,
  ) {}
  // #endregion

  // #region Methods
  /** Runs the account avatar operation. */
  public execute(input: GetAvatarUploadInput): Promise<GetAvatarUploadOutput> {
    return this.work.run(async (store) => {
      const user = await lockAvatarOwner(store, input);
      const upload = await store.findUpload(user.id, input.uploadId.toLowerCase());
      if (upload === null) throw new AvatarRefusal('not-found');
      const state = upload.readStatus({
        userId: user.id,
        generation: user.avatarGeneration,
        now: this.now(),
      });
      return { uploadId: upload.snapshot.id, expiresAt: upload.snapshot.expiresAt, state };
    });
  }
  // #endregion
}
