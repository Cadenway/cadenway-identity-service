import type { Membership } from '../../../../../domain/aggregates/membership/membership.aggregate.js';
import type { MembershipRepository } from '../../../../ports/outbound/persistence/membership/membership-repository.port.js';
import type { MembershipsUnitOfWork } from '../../../../ports/outbound/transactions/membership/memberships-unit-of-work.port.js';
import type { FindActiveMembershipInput } from './find-active-membership.input.js';
import type { FindActiveMembershipOutput } from './find-active-membership.output.js';

/**
 * Class FindActiveMembership
 *
 * @description
 * Tells whether an account is a member of an organization in the copy of the memberships, and with
 * which role: the entry point the sessions module (choice of an organization, introspection, new
 * session) and the api-tokens module (introspection) consume. It runs in the system transaction of
 * its caller and joins it; the read names the organization and the account. A membership
 * organization-service created a few seconds ago may not be here yet: the caller answers as for a
 * non-member (`organization.not-found`, an inactive token) and the web application retries.
 */
export class FindActiveMembership {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The system transaction of the caller.
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
   * @param {MembershipsUnitOfWork} unitOfWork - The system transaction of the caller.
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
   * Finds the active membership.
   *
   * @param {FindActiveMembershipInput} input - The organization and the account.
   * @returns {Promise<FindActiveMembershipOutput | null>} The membership, or `null` when the account
   * is not a member, was removed, or its membership has not reached this service yet.
   */
  public async execute(
    input: FindActiveMembershipInput,
  ): Promise<FindActiveMembershipOutput | null> {
    const membership: Membership | null = await this.unitOfWork.run(
      (memberships: MembershipRepository): Promise<Membership | null> =>
        memberships.findActive(input.organizationId, input.userId),
    );
    if (membership === null) {
      return null;
    }
    const { id, organizationId, userId, role } = membership.snapshot;
    return { memberId: id, organizationId, userId, role };
  }
  // #endregion
}
