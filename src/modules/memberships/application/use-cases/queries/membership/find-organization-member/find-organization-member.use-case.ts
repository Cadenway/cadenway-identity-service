import type { Membership } from '../../../../../domain/aggregates/membership/membership.aggregate.js';
import type { MembershipRepository } from '../../../../ports/outbound/persistence/membership/membership-repository.port.js';
import type { MembershipsUnitOfWork } from '../../../../ports/outbound/transactions/membership/memberships-unit-of-work.port.js';
import type { FindOrganizationMemberInput } from './find-organization-member.input.js';
import type { FindOrganizationMemberOutput } from './find-organization-member.output.js';

/**
 * Class FindOrganizationMember
 *
 * @description
 * The role of an account in the organization of the request, from the copy of the memberships:
 * only the owner and the admins read and change the authentication policy of an organization
 * (`GET` and `PATCH /internal/v1/organization/authentication-policy`). Runs in the tenant
 * transaction of that organization and joins it (it must not be called from a system one); the
 * policy of the kit hides the rows of any other organization, and the query names it again.
 */
export class FindOrganizationMember {
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
   * Reads the active membership of the account in the organization.
   *
   * @param {FindOrganizationMemberInput} input - The organization and the account.
   * @returns {Promise<FindOrganizationMemberOutput | null>} Its role, or `null` when the copy holds
   * no active membership.
   */
  public async execute(
    input: FindOrganizationMemberInput,
  ): Promise<FindOrganizationMemberOutput | null> {
    const membership: Membership | null = await this.unitOfWork.run(
      (repository: MembershipRepository): Promise<Membership | null> =>
        repository.findActive(input.organizationId, input.userId),
    );
    return membership === null ? null : { role: membership.snapshot.role };
  }
  // #endregion
}
