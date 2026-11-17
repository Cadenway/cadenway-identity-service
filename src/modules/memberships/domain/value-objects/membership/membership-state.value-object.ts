import type { MemberRole } from './member-role.value-object.js';

/**
 * Interface MembershipState
 *
 * @description
 * What this service keeps of a membership: the copy of the memberships the introspections and the
 * choice of an organization read.
 */
export interface MembershipState {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * The `memberId` organization-service gave the membership: a person who joins again after a
   * removal gets a new one.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property organizationId
   *
   * @description
   * Organization of the membership.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property userId
   *
   * @description
   * Account of the member.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property role
   *
   * @description
   * Role of the highest version applied.
   *
   * @type {MemberRole}
   * @readonly
   */
  readonly role: MemberRole;

  /**
   * Property version
   *
   * @description
   * Highest version of the membership applied so far.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;

  /**
   * Property removedAt
   *
   * @description
   * When the membership ended (`member.removed.v1`), or `null` while it is active.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly removedAt: Date | null;
  // #endregion
}
