import { InvalidMembershipStateError } from '../../errors/membership/invalid-membership-state.error.js';
import { MembershipMismatchError } from '../../errors/membership/membership-mismatch.error.js';
import type { MemberRole } from '../../value-objects/membership/member-role.value-object.js';
import type { MembershipChange } from '../../value-objects/membership/membership-change.value-object.js';
import type { MembershipState } from '../../value-objects/membership/membership-state.value-object.js';

/**
 * Class Membership
 *
 * @description
 * The copy this service keeps of a membership of organization-service. Rules, from
 * `asyncapi/organization-service.yaml` ("Memberships") and decision 3 of the P2b plan:
 *
 * - the version of the membership orders its events, which travel on three subjects and may arrive
 *   in any order: a version already applied, or an older one, changes nothing;
 * - a removed membership stays removed: `member.removed.v1` is its last change, so a late
 *   `member.joined.v1` or `member.role-changed.v1` never brings it back, and a removal applies
 *   whatever arrived before it;
 * - a membership never moves: an event that names another organization or account is a defect;
 * - the first event seen creates the copy, whichever it is: a `member.role-changed.v1` proves the
 *   membership began, a removal seen first keeps a removed copy so the late join stays ignored.
 */
export class Membership {
  // #region Properties
  /**
   * Property state
   *
   * @description
   * The state of the membership; a change returns a new `Membership`.
   *
   * @type {MembershipState}
   * @readonly
   */
  private readonly state: MembershipState;

  /**
   * Property snapshot
   *
   * @description
   * The state to store.
   *
   * @type {MembershipState}
   * @readonly
   */
  public get snapshot(): MembershipState {
    return this.state;
  }

  /**
   * Property isActive
   *
   * @description
   * Whether the account is a member: the membership began and was not removed.
   *
   * @type {boolean}
   * @readonly
   */
  public get isActive(): boolean {
    return this.state.removedAt === null;
  }
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Keeps a state checked by `restore` or built by `begin`.
   *
   * @param {MembershipState} state - The checked state.
   * @constructor
   */
  private constructor(state: MembershipState) {
    this.state = state;
  }
  // #endregion

  // #region Methods
  /**
   * Method begin
   *
   * @description
   * The copy of a membership this service has not seen yet, from its first event, whichever it is.
   *
   * @param {MembershipChange} change - The first event seen.
   * @returns {Membership} The copy to store.
   * @throws {InvalidMembershipStateError} When the version is not a positive integer.
   */
  public static begin(change: MembershipChange): Membership {
    return Membership.restore({
      id: change.memberId,
      organizationId: change.organizationId,
      userId: change.userId,
      role: change.role,
      version: change.version,
      removedAt: change.kind === 'removed' ? change.occurredAt : null,
    });
  }

  /**
   * Method restore
   *
   * @description
   * Rebuilds a stored membership.
   *
   * @param {MembershipState} state - The stored state.
   * @returns {Membership} The membership.
   * @throws {InvalidMembershipStateError} When the version is not a positive integer.
   */
  public static restore(state: MembershipState): Membership {
    if (!Number.isInteger(state.version) || state.version < 1) {
      throw new InvalidMembershipStateError('the version is a positive integer');
    }
    return new Membership(state);
  }

  /**
   * Method apply
   *
   * @description
   * Applies a later event of the membership: the same membership when it changes nothing (a
   * version already applied or older, any event after the removal), a new one otherwise. The
   * removal applies whatever version arrived before it, and keeps the role of the highest version.
   *
   * @param {MembershipChange} change - The event.
   * @returns {Membership} The membership to store, or this one when nothing changes.
   * @throws {MembershipMismatchError} When the event names another organization or account.
   * @throws {InvalidMembershipStateError} When the version is not a positive integer.
   */
  public apply(change: MembershipChange): Membership {
    if (
      change.organizationId !== this.state.organizationId ||
      change.userId !== this.state.userId
    ) {
      throw new MembershipMismatchError();
    }
    if (!this.isActive) {
      return this;
    }
    const newer: boolean = change.version > this.state.version;
    if (change.kind === 'removed') {
      const role: MemberRole = newer ? change.role : this.state.role;
      return Membership.restore({
        ...this.state,
        role,
        version: Math.max(this.state.version, change.version),
        removedAt: change.occurredAt,
      });
    }
    if (!newer) {
      return this;
    }
    return Membership.restore({ ...this.state, role: change.role, version: change.version });
  }
  // #endregion
}
