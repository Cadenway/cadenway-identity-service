import type { AuthenticationPolicy } from '../../../../../domain/aggregates/authentication-policy/authentication-policy.aggregate.js';
import type { SessionsStore } from '../../../../models/session/sessions-store.model.js';
import type { OrganizationMembers } from '../../../../ports/outbound/memberships/authentication-policy/organization-members.port.js';
import type { SessionsUnitOfWork } from '../../../../ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { AuthenticationPolicyView } from '../../../../projections/authentication-policy/authentication-policy-view.projection.js';
import {
  assertPolicyEditor,
  toAuthenticationPolicyView,
} from '../../../../services/authentication-policy/authentication-policy-view.service.js';
import type { GetAuthenticationPolicyInput } from './get-authentication-policy.input.js';

/**
 * Class GetAuthenticationPolicy
 *
 * @description
 * Reads the authentication policy of the organization of the internal token (`GET
 * /internal/v1/organization/authentication-policy`), with the counts of its members without
 * two-step verification, for its owner and its admins only, in the tenant transaction of that
 * organization.
 */
export class GetAuthenticationPolicy {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The tenant transaction of the organization of the internal token.
   *
   * @type {SessionsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: SessionsUnitOfWork;

  /**
   * Property members
   *
   * @description
   * The copy of the memberships, in that transaction.
   *
   * @type {OrganizationMembers}
   * @readonly
   */
  private readonly members: OrganizationMembers;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes its ports, bound by the composition of the module.
   *
   * @param {SessionsUnitOfWork} unitOfWork - The tenant transaction of the organization of the internal token.
   * @param {OrganizationMembers} members - The copy of the memberships, in that transaction.
   * @constructor
   */
  public constructor(unitOfWork: SessionsUnitOfWork, members: OrganizationMembers) {
    this.unitOfWork = unitOfWork;
    this.members = members;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Reads the policy for its owner or one of its admins.
   *
   * @param {GetAuthenticationPolicyInput} input - The actor and the organization.
   * @returns {Promise<AuthenticationPolicyView>} The policy and its counts.
   * @throws {AuthenticationPolicyRefusal} `organization-not-found` or `role-forbidden`.
   */
  public async execute(input: GetAuthenticationPolicyInput): Promise<AuthenticationPolicyView> {
    return this.unitOfWork.run(async (store: SessionsStore): Promise<AuthenticationPolicyView> => {
      assertPolicyEditor(await this.members.roleOf(input.organizationId, input.actorUserId));
      const policy: AuthenticationPolicy = await store.policies.find(input.organizationId);
      return toAuthenticationPolicyView(store, this.members, policy);
    });
  }
  // #endregion
}
