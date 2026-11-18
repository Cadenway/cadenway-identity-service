import type { AuthenticationPolicy } from '../../../../../domain/aggregates/authentication-policy/authentication-policy.aggregate.js';
import type { SessionsStore } from '../../../../models/session/sessions-store.model.js';
import type { UserMembership } from '../../../../models/session/user-membership.model.js';
import type { ActiveMemberships } from '../../../../ports/outbound/memberships/session/active-memberships.port.js';
import type { SessionsUnitOfWork } from '../../../../ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { FindTwoStepRequirementsInput } from './find-two-step-requirements.input.js';
import type { FindTwoStepRequirementsOutput } from './find-two-step-requirements.output.js';

/**
 * Class FindTwoStepRequirements
 *
 * @description
 * Reads the organizations whose authentication policy requires two-step verification of an account,
 * for the role it has in each (decision 8 of P2c): `requiredBy` of its two-step verification, and
 * the refusal to turn it off (`409 auth.mfa-required-by-organization`). The active memberships come
 * from the copy of the memberships, the policies of their organizations in one query; the work
 * grows with the organizations of the account. Joins the system transaction of its caller.
 */
export class FindTwoStepRequirements {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The system transaction, joined to the one of the caller.
   *
   * @type {SessionsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: SessionsUnitOfWork;

  /**
   * Property memberships
   *
   * @description
   * The copy of the memberships.
   *
   * @type {ActiveMemberships}
   * @readonly
   */
  private readonly memberships: ActiveMemberships;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes its ports, bound by the composition of the module.
   *
   * @param {SessionsUnitOfWork} unitOfWork - The system transaction, joined to the one of the caller.
   * @param {ActiveMemberships} memberships - The copy of the memberships.
   * @constructor
   */
  public constructor(unitOfWork: SessionsUnitOfWork, memberships: ActiveMemberships) {
    this.unitOfWork = unitOfWork;
    this.memberships = memberships;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Lists the requirements of two-step verification of the account.
   *
   * @param {FindTwoStepRequirementsInput} input - The account.
   * @returns {Promise<FindTwoStepRequirementsOutput>} The organizations that require it, ordered by organization.
   */
  public async execute(
    input: FindTwoStepRequirementsInput,
  ): Promise<FindTwoStepRequirementsOutput> {
    return this.unitOfWork.run(
      async (store: SessionsStore): Promise<FindTwoStepRequirementsOutput> => {
        const memberships: readonly UserMembership[] = await this.memberships.listOfUser(
          input.userId,
        );
        const policies: AuthenticationPolicy[] = await store.policies.findMany(
          memberships.map((membership: UserMembership): string => membership.organizationId),
        );
        const requirements: {
          readonly organizationId: string;
          readonly requiredFor: 'admins' | 'everyone';
        }[] = [];
        memberships.forEach((membership: UserMembership, index: number): void => {
          const policy: AuthenticationPolicy | undefined = policies[index];
          if (policy?.requiresTwoStepFor(membership.role) === true) {
            requirements.push({
              organizationId: membership.organizationId,
              requiredFor:
                policy.snapshot.twoStepVerificationRequiredFor === 'everyone'
                  ? 'everyone'
                  : 'admins',
            });
          }
        });
        return { requirements };
      },
    );
  }
  // #endregion
}
