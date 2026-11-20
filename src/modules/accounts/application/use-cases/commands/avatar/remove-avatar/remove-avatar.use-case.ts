import type { AvatarVersion } from '../../../../models/avatar/avatar-version.model.js';
import type { AvatarUnitOfWork } from '../../../../ports/outbound/transactions/avatar/avatar-unit-of-work.port.js';
import { lockAvatarOwner } from '../../../../services/avatar/avatar-owner.service.js';
import type { RemoveAvatarInput } from './remove-avatar.input.js';

/** Clears an avatar and fences all older pending uploads under the account lock. */
export class RemoveAvatar {
  // #region Constructor
  /** Binds the account transaction and operation dependencies. */
  public constructor(private readonly work: AvatarUnitOfWork) {}
  // #endregion

  // #region Methods
  /** Runs the account avatar operation. */
  public execute(input: RemoveAvatarInput): Promise<AvatarVersion> {
    return this.work.run(async (store) => {
      const user = await lockAvatarOwner(store, input);
      const result = user.clearAvatar(input.expectedVersion);
      await store.saveAvatar(user, result.user);
      if (result.change !== null) await store.appendChanged(result.change);
      return { version: result.user.version };
    });
  }
  // #endregion
}
