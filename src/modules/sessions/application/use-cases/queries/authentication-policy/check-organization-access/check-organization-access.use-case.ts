import { isOrganizationWithheld } from '../../../../services/authentication-policy/organization-access.service.js';
import type { SessionsStore } from '../../../../models/session/sessions-store.model.js';
import type { SessionsUnitOfWork } from '../../../../ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { CheckOrganizationAccessInput } from './check-organization-access.input.js';
import type { CheckOrganizationAccessOutput } from './check-organization-access.output.js';

/**
 * Class CheckOrganizationAccess
 *
 * @description
 * Tells whether an organization is withheld from a member: its policy requires two-step
 * verification for the role of the member, whose account has none ("Withheld organization" of the
 * internal contract). The introspection of a personal API token calls it once the membership is
 * found; it joins its system transaction.
 */
export class CheckOrganizationAccess {
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
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes its ports, bound by the composition of the module.
   *
   * @param {SessionsUnitOfWork} unitOfWork - The system transaction, joined to the one of the caller.
   * @constructor
   */
  public constructor(unitOfWork: SessionsUnitOfWork) {
    this.unitOfWork = unitOfWork;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Applies the policy of the organization to the member.
   *
   * @param {CheckOrganizationAccessInput} input - The organization, the account and its role.
   * @returns {Promise<CheckOrganizationAccessOutput>} Whether the organization is withheld.
   */
  public async execute(
    input: CheckOrganizationAccessInput,
  ): Promise<CheckOrganizationAccessOutput> {
    return this.unitOfWork.run(
      async (store: SessionsStore): Promise<CheckOrganizationAccessOutput> => ({
        withheld: await isOrganizationWithheld(
          store,
          input.organizationId,
          input.userId,
          input.role,
        ),
      }),
    );
  }
  // #endregion
}
