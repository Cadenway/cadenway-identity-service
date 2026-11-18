import type { Membership } from '../../../../../domain/aggregates/membership/membership.aggregate.js';
import type { MembershipRepository } from '../../../../ports/outbound/persistence/membership/membership-repository.port.js';
import type { MembershipsUnitOfWork } from '../../../../ports/outbound/transactions/membership/memberships-unit-of-work.port.js';
import type { FindUserMembershipsInput } from './find-user-memberships.input.js';
import type { FindUserMembershipsOutput } from './find-user-memberships.output.js';

/**
 * Class FindUserMemberships
 *
 * @description
 * The active memberships of an account across organizations, from the copy of the memberships:
 * the requirements of two-step verification of an account read its role in each organization
 * ("Authentication policy" of `openapi/internal/identity-service.yaml`, decision 8 of P2c), for
 * `requiredBy` and for the refusal to turn it off. Runs in the system transaction of its caller and
 * joins it; it reads the memberships of one account, bounded by the organizations it belongs to.
 */
export class FindUserMemberships {
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
   * Takes the unit of work.
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
   * Reads the active memberships of the account.
   *
   * @param {FindUserMembershipsInput} input - The account.
   * @returns {Promise<FindUserMembershipsOutput>} Its organizations and roles.
   */
  public async execute(input: FindUserMembershipsInput): Promise<FindUserMembershipsOutput> {
    const memberships: Membership[] = await this.unitOfWork.run(
      (repository: MembershipRepository): Promise<Membership[]> =>
        repository.findActiveOfUser(input.userId),
    );
    return {
      memberships: memberships.map((membership: Membership) => ({
        organizationId: membership.snapshot.organizationId,
        role: membership.snapshot.role,
      })),
    };
  }
  // #endregion
}
