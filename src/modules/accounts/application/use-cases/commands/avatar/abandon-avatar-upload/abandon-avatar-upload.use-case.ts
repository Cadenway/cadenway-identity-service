import type { AvatarUnitOfWork } from '../../../../ports/outbound/transactions/avatar/avatar-unit-of-work.port.js';
import type { AbandonAvatarUploadInput } from './abandon-avatar-upload.input.js';

/** Retires a no-longer-usable reservation and emits its cleanup fact atomically. */
export class AbandonAvatarUpload {
  // #region Constructor
  /** Binds the account transaction and operation dependencies. */
  public constructor(
    private readonly work: AvatarUnitOfWork,
    private readonly now: () => Date,
  ) {}
  // #endregion

  // #region Methods
  /** Runs the account avatar operation. */
  public execute(input: AbandonAvatarUploadInput): Promise<boolean> {
    return this.work.run(async (store) => {
      const user = await store.lockUser(input.userId.toLowerCase());
      if (user === null) return false;
      const upload = await store.lockUpload(user.id, input.uploadId.toLowerCase());
      if (upload === null) return false;
      const abandoned = upload.abandonIfUnusable({
        userId: user.id,
        generation: user.avatarGeneration,
        now: this.now(),
      });
      if (abandoned === null) return false;
      await store.saveUpload(abandoned.upload);
      await store.appendAbandoned(abandoned.event);
      return true;
    });
  }
  // #endregion
}
