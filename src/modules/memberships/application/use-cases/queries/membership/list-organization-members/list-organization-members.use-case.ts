import type { Membership } from '../../../../../domain/aggregates/membership/membership.aggregate.js';
import type { MembershipRepository } from '../../../../ports/outbound/persistence/membership/membership-repository.port.js';
import type { MembershipsUnitOfWork } from '../../../../ports/outbound/transactions/membership/memberships-unit-of-work.port.js';
import type { ListOrganizationMembersInput } from './list-organization-members.input.js';
import type { ListOrganizationMembersOutput } from './list-organization-members.output.js';

/**
 * Class ListOrganizationMembers
 *
 * @description
 * The active members of the organization of the request, from the copy of the memberships: the
 * authentication policy counts those without two-step verification
 * (`membersWithoutTwoStepVerification` of `AuthenticationPolicy`, "<N> personnes ne l'ont pas
 * configurée"). Runs in the tenant transaction of that organization and joins it. The answer grows
 * with the members of the organization; only the owner and the admins read it, on the policy page.
 */
export class ListOrganizationMembers {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The tenant transaction, joined to the one of the caller.
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
   * Takes the unit of work.
   *
   * @param {MembershipsUnitOfWork} unitOfWork - The tenant transaction.
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
   * Reads the active members of the organization.
   *
   * @param {ListOrganizationMembersInput} input - The organization.
   * @returns {Promise<ListOrganizationMembersOutput>} Its accounts and roles.
   */
  public async execute(
    input: ListOrganizationMembersInput,
  ): Promise<ListOrganizationMembersOutput> {
    const memberships: Membership[] = await this.unitOfWork.run(
      (repository: MembershipRepository): Promise<Membership[]> =>
        repository.listActiveOfOrganization(input.organizationId),
    );
    return {
      members: memberships.map((membership: Membership) => ({
        userId: membership.snapshot.userId,
        role: membership.snapshot.role,
      })),
    };
  }
  // #endregion
}
