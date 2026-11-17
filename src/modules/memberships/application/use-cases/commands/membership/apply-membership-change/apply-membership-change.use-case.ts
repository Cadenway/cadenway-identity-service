import { Membership } from '../../../../../domain/aggregates/membership/membership.aggregate.js';
import { MembershipMismatchError } from '../../../../../domain/errors/membership/membership-mismatch.error.js';
import type { MembershipRepository } from '../../../../ports/outbound/persistence/membership/membership-repository.port.js';
import type { MembershipsUnitOfWork } from '../../../../ports/outbound/transactions/membership/memberships-unit-of-work.port.js';
import type { ApplyMembershipChangeInput } from './apply-membership-change.input.js';

/**
 * Class ApplyMembershipChange
 *
 * @description
 * Applies a `member.joined.v1`, `member.role-changed.v1` or `member.removed.v1` to the copy of the
 * memberships, by the version of the membership (`Membership.apply`). Idempotent: an event applied
 * twice, or older than the copy, changes nothing, so a redelivery the deduplicator of the kit did
 * not catch is harmless. It runs in the tenant transaction of the organization of the event, which
 * the deduplicator opened and records the event id in: the copy and the processed id commit
 * together. Two events of a new membership handled at once both try to insert it; the second waits
 * for the first, then applies itself on the stored copy.
 */
export class ApplyMembershipChange {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The tenant transaction of the event.
   *
   * @type {MembershipsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: MembershipsUnitOfWork;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the transaction port.
   *
   * @param {MembershipsUnitOfWork} unitOfWork - The tenant transaction of the event.
   * @constructor
   */
  public constructor(unitOfWork: MembershipsUnitOfWork) {
    this.unitOfWork = unitOfWork;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Applies the event.
   *
   * @param {ApplyMembershipChangeInput} input - The member event.
   * @returns {Promise<void>} Resolves once applied, or at once when it changes nothing.
   * @throws {MembershipMismatchError} When the event names another organization or account than
   * the stored membership, or a membership id stored under another organization: the kit retries
   * it, then keeps it as a dead letter.
   */
  public async execute(input: ApplyMembershipChangeInput): Promise<void> {
    await this.unitOfWork.run(async (memberships: MembershipRepository): Promise<void> => {
      const stored: Membership | null = await memberships.lock(
        input.organizationId,
        input.memberId,
      );
      if (stored === null && (await memberships.insertIfAbsent(Membership.begin(input)))) {
        return;
      }
      const current: Membership | null =
        stored ?? (await memberships.lock(input.organizationId, input.memberId));
      if (current === null) {
        // The id exists, but row-level security hides it: it belongs to another organization.
        throw new MembershipMismatchError();
      }
      const applied: Membership = current.apply(input);
      if (applied !== current) {
        await memberships.update(applied);
      }
    });
  }
  // #endregion
}
