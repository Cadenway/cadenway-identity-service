import type { MembershipRepository } from '../../../../ports/outbound/persistence/membership/membership-repository.port.js';
import type { MembershipsUnitOfWork } from '../../../../ports/outbound/transactions/membership/memberships-unit-of-work.port.js';
import type { FindOwnedOrganizationsInput } from './find-owned-organizations.input.js';
import type { FindOwnedOrganizationsOutput } from './find-owned-organizations.output.js';

/**
 * Class FindOwnedOrganizations
 *
 * @description
 * The organizations an account owns in the copy of the memberships: the role `owner` of a
 * membership that is not removed, which `member.joined.v1` gives the creator of an organization
 * ("Ownership" of `openapi/internal/identity-service.yaml`). The scheduling of the deletion of an
 * account refuses an owner (`409 account.organization-owner`, decision 9 of P2c) and its final
 * deletion checks again; identity-service never calls organization-service for it. An organization
 * created in the seconds before may not be in the copy yet. Runs in the system transaction of its
 * caller and joins it; it reads the memberships of one account across organizations.
 */
export class FindOwnedOrganizations {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The system transaction, joined to the one of the caller.
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
   * Takes the transaction.
   *
   * @param {MembershipsUnitOfWork} unitOfWork - The system transaction.
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
   * Lists the organizations the account owns.
   *
   * @param {FindOwnedOrganizationsInput} input - The account.
   * @returns {Promise<FindOwnedOrganizationsOutput>} Their ids.
   */
  public async execute(input: FindOwnedOrganizationsInput): Promise<FindOwnedOrganizationsOutput> {
    const organizationIds: string[] = await this.unitOfWork.run(
      (memberships: MembershipRepository): Promise<string[]> =>
        memberships.findOwnedOrganizationIds(input.userId),
    );
    return { organizationIds };
  }
  // #endregion
}
