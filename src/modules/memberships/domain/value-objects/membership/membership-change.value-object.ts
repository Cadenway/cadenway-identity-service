import type { MemberRole } from './member-role.value-object.js';

/**
 * Interface MembershipChange
 *
 * @description
 * One event of a membership, as organization-service emits it (`member.joined.v1`,
 * `member.role-changed.v1`, `member.removed.v1` of `asyncapi/organization-service.yaml`): the
 * membership, the version it reached and the role it holds.
 */
export interface MembershipChange {
  // #region Properties
  /**
   * Property kind
   *
   * @description
   * Which event: the membership began, its role changed, or it ended (its last change).
   *
   * @type {'joined' | 'role-changed' | 'removed'}
   * @readonly
   */
  readonly kind: 'joined' | 'role-changed' | 'removed';

  /**
   * Property memberId
   *
   * @description
   * Id of the membership, the aggregate the version orders.
   *
   * @type {string}
   * @readonly
   */
  readonly memberId: string;

  /**
   * Property organizationId
   *
   * @description
   * Organization of the membership, the organization of the event envelope.
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
   * Role after the change; for a removal, the role the member had.
   *
   * @type {MemberRole}
   * @readonly
   */
  readonly role: MemberRole;

  /**
   * Property version
   *
   * @description
   * Version of the membership after the change: 1 when it begins.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;

  /**
   * Property occurredAt
   *
   * @description
   * When organization-service committed the change.
   *
   * @type {Date}
   * @readonly
   */
  readonly occurredAt: Date;
  // #endregion
}
