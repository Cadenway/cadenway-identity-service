import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { AvatarUnitOfWork } from '../../../../ports/outbound/transactions/avatar/avatar-unit-of-work.port.js';
import type { GetAvatarReferenceInput } from './get-avatar-reference.input.js';
import type { GetAvatarReferenceOutput } from './get-avatar-reference.output.js';

/** Reads an account reference following the gateway's membership authorization. */
export class GetAvatarReference {
  // #region Constructor
  /** Binds the account transaction and operation dependencies. */
  public constructor(private readonly work: AvatarUnitOfWork) {}
  // #endregion

  // #region Methods
  /** Runs the account avatar operation. */
  public execute(input: GetAvatarReferenceInput): Promise<GetAvatarReferenceOutput> {
    if (
      input.actorUserId.toLowerCase() !== input.userId.toLowerCase() &&
      input.organizationId === null
    ) {
      throw new AccountRefusal({ reason: 'user-not-found' });
    }
    return this.work.run(
      async (store) => {
        const user = await store.findUser(input.userId.toLowerCase());
        if (user === null) throw new AccountRefusal({ reason: 'user-not-found' });
        return { assetId: user.avatarId };
      },
      { readOnly: true },
    );
  }
  // #endregion
}
