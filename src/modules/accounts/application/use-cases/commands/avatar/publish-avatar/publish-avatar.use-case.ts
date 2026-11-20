import { AvatarRefusal } from '../../../../../domain/errors/avatar/avatar-refusal.error.js';
import type { AvatarVersion } from '../../../../models/avatar/avatar-version.model.js';
import type { AvatarUnitOfWork } from '../../../../ports/outbound/transactions/avatar/avatar-unit-of-work.port.js';
import { lockAvatarOwner } from '../../../../services/avatar/avatar-owner.service.js';
import type { PublishAvatarInput } from './publish-avatar.input.js';

/** Adopts the prepared upload and records its change in the same account transaction. */
export class PublishAvatar {
  // #region Constructor
  /** Binds the account transaction and operation dependencies. */
  public constructor(
    private readonly work: AvatarUnitOfWork,
    private readonly now: () => Date,
  ) {}
  // #endregion

  // #region Methods
  /** Runs the account avatar operation. */
  public execute(input: PublishAvatarInput): Promise<AvatarVersion> {
    return this.work.run(async (store) => {
      const user = await lockAvatarOwner(store, input);
      const upload = await store.lockUpload(user.id, input.uploadId.toLowerCase());
      if (upload === null) throw new AvatarRefusal('not-found');
      const result = user.publishAvatar(upload, this.now(), input.expectedVersion);
      if (result.change !== null) {
        await store.saveAvatar(user, result.user);
        await store.saveUpload(result.upload);
        await store.appendChanged(result.change);
      }
      return { version: result.user.version };
    });
  }
  // #endregion
}
