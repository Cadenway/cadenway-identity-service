import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import type { ProfileUpdate } from '../../../../../domain/value-objects/profile/profile-update.value-object.js';
import { toAccountView } from '../../../../mappers/accounts/account-view.mapper.js';
import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { AccountView } from '../../../../projections/accounts/account-view.projection.js';
import type { UpdateUserProfileInput } from './update-user-profile.input.js';

/**
 * Class UpdateUserProfile
 *
 * @description
 * Applies a merge patch to the profile of the account of the actor
 * (`PATCH /internal/v1/users/{userId}`, `PATCH /v1/me` of `openapi/public/auth.yaml`). In one system
 * transaction it locks the account, checks `If-Match` against its version, applies the patch
 * (`User.updateProfile`), writes the account and appends `user.profile-updated.v1` together; a
 * patch that changes nothing writes nothing and appends nothing.
 *
 * - Another id, or an unknown one, answers `user.not-found`: a user changes its own profile only.
 * - A version `If-Match` does not accept answers `request.version-mismatch`, with the current one.
 */
export class UpdateUserProfile {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transaction of the change.
   *
   * @type {AccountsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: AccountsUnitOfWork;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the transaction port.
   *
   * @param {AccountsUnitOfWork} unitOfWork - The transaction of the change.
   * @constructor
   */
  public constructor(unitOfWork: AccountsUnitOfWork) {
    this.unitOfWork = unitOfWork;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Changes the profile.
   *
   * @param {UpdateUserProfileInput} input - The actor, the account, the version and the patch.
   * @returns {Promise<AccountView>} The account after the change.
   * @throws {AccountRefusal} `user-not-found` for another or an unknown account,
   * `version-mismatch` when `If-Match` names another version.
   */
  public async execute(input: UpdateUserProfileInput): Promise<AccountView> {
    if (input.actorUserId !== input.userId) {
      throw new AccountRefusal({ reason: 'user-not-found' });
    }
    return this.unitOfWork.run(async (store: AccountsStore): Promise<AccountView> => {
      const user: User | null = await store.users.lock(input.userId);
      if (user === null) {
        throw new AccountRefusal({ reason: 'user-not-found' });
      }
      if (input.expectedVersions !== null && !input.expectedVersions.includes(user.version)) {
        throw new AccountRefusal({ reason: 'version-mismatch', version: user.version });
      }
      const update: ProfileUpdate = user.updateProfile(input.patch);
      if (update.changed.length > 0) {
        await store.users.update(update.user);
        await store.events.userProfileUpdated(update.user, update.changed);
      }
      return toAccountView(update.user);
    });
  }
  // #endregion
}
