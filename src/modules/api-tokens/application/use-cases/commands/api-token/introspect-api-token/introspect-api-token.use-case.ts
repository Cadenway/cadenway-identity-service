import type { ApiToken } from '../../../../../domain/aggregates/api-token/api-token.aggregate.js';
import type { ActiveMembership } from '../../../../models/api-token/active-membership.model.js';
import type { ActiveMemberships } from '../../../../ports/outbound/memberships/api-token/active-memberships.port.js';
import type { OrganizationAccess } from '../../../../ports/outbound/sessions/api-token/organization-access.port.js';
import type { ApiTokenRepository } from '../../../../ports/outbound/persistence/api-token/api-token-repository.port.js';
import type { ApiTokenSecrets } from '../../../../ports/outbound/security/api-token/api-token-secrets.port.js';
import type { Clock } from '../../../../ports/outbound/time/api-token/clock.port.js';
import type { ApiTokensUnitOfWork } from '../../../../ports/outbound/transactions/api-token/api-tokens-unit-of-work.port.js';
import type { IntrospectApiTokenInput } from './introspect-api-token.input.js';
import type { IntrospectApiTokenOutput } from './introspect-api-token.output.js';

/**
 * Class IntrospectApiToken
 *
 * @description
 * Tells whether a personal API token is active (`POST /internal/v1/api-tokens/introspect`). The
 * gateway calls it on every request with a bearer token and never caches the answer. A token is
 * active when it is known by the hash of its secret, neither revoked nor expired, and its user is
 * still a member of its organization in the copy of the memberships; any other value, a malformed
 * one or a session token included, answers `active: false`, never an error. An active answer
 * records the use, at most once a minute, without a lock: a concurrent later write wins. It runs in
 * one system transaction, which the reading of the memberships joins; calling it twice has the
 * effect of calling it once. While the policy of its organization requires two-step verification
 * for the role of its user, who has none, the token stays active but acts on nothing: `scopes` is
 * empty and `withheldOrganizationId` names the organization (decision 8 of P2c).
 */
export class IntrospectApiToken {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The system transaction of the introspection.
   *
   * @type {ApiTokensUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: ApiTokensUnitOfWork;

  /**
   * Property secrets
   *
   * @description
   * Hashes the presented token.
   *
   * @type {ApiTokenSecrets}
   * @readonly
   */
  private readonly secrets: ApiTokenSecrets;

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

  /**
   * Property clock
   *
   * @description
   * The time of the request.
   *
   * @type {Clock}
   * @readonly
   */
  private readonly clock: Clock;

  /**
   * Property access
   *
   * @description
   * The authentication policy of the organization of the token.
   *
   * @type {OrganizationAccess}
   * @readonly
   */
  private readonly access: OrganizationAccess;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the ports of the introspection.
   *
   * @param {ApiTokensUnitOfWork} unitOfWork - The system transaction of the introspection.
   * @param {ApiTokenSecrets} secrets - Hashes the presented token.
   * @param {ActiveMemberships} memberships - The copy of the memberships.
   * @param {Clock} clock - The time of the request.
   * @param {OrganizationAccess} access - The authentication policy of the organization.
   * @constructor
   */
  public constructor(
    unitOfWork: ApiTokensUnitOfWork,
    secrets: ApiTokenSecrets,
    memberships: ActiveMemberships,
    clock: Clock,
    access: OrganizationAccess,
  ) {
    this.unitOfWork = unitOfWork;
    this.secrets = secrets;
    this.memberships = memberships;
    this.clock = clock;
    this.access = access;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Introspects a token.
   *
   * @param {IntrospectApiTokenInput} input - The bearer token.
   * @returns {Promise<IntrospectApiTokenOutput>} Whether it is active, and its subject when it is.
   */
  public async execute(input: IntrospectApiTokenInput): Promise<IntrospectApiTokenOutput> {
    const tokenHash: string | null = this.secrets.hashOf(input.token);
    if (tokenHash === null) {
      return { active: false };
    }
    const now: Date = this.clock.now();
    return this.unitOfWork.run(
      async (tokens: ApiTokenRepository): Promise<IntrospectApiTokenOutput> => {
        const token: ApiToken | null = await tokens.findByTokenHash(tokenHash);
        if (!token?.isActiveAt(now)) {
          return { active: false };
        }
        const { organizationId, userId, scopes, expiresAt } = token.snapshot;
        const membership: ActiveMembership | null = await this.memberships.find(
          organizationId,
          userId,
        );
        if (membership === null) {
          return { active: false };
        }
        const withheld: boolean = await this.access.isWithheld(
          organizationId,
          userId,
          membership.role,
        );
        const used: ApiToken = token.recordUse(now);
        if (used !== token) {
          await tokens.recordUse(used);
        }
        return {
          active: true,
          tokenType: 'api-token',
          apiTokenId: token.id,
          userId,
          organizationId,
          role: membership.role,
          scopes: withheld ? [] : scopes,
          expiresAt,
          withheldOrganizationId: withheld ? organizationId : null,
        };
      },
    );
  }
  // #endregion
}
