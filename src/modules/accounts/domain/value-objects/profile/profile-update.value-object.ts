import type { User } from '../../aggregates/account/user.aggregate.js';

/**
 * Interface ProfileUpdate
 *
 * @description
 * The account after a profile patch and the members that moved, in the order of the contract
 * (`changed` of `user.profile-updated.v1`): `name`, `displayName`, `jobTitle`, `timeZone`,
 * `language`. An empty `changed` means the patch changed nothing and `user` is the same account.
 */
export interface ProfileUpdate {
  // #region Properties
  /**
   * Property user
   *
   * @description
   * The account after the patch, with the next version when something changed.
   *
   * @type {User}
   * @readonly
   */
  readonly user: User;

  /**
   * Property changed
   *
   * @description
   * The members that moved.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly changed: readonly string[];
  // #endregion
}
