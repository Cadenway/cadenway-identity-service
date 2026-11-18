import type { AuthenticationPolicy } from '@cadenway/contracts/types/internal/identity-service';
import {
  getOrganizationContext,
  InternalAccess,
  parseIfMatch,
  ProblemException,
} from '@cadenway/nest-common';
import type { IfMatchCondition, OrganizationContext } from '@cadenway/nest-common';
import { Body, Controller, Get, Headers, Patch, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

import { AuthenticationPolicyRefusal } from '../../../../application/models/authentication-policy/authentication-policy-refusal.model.js';
import type { AuthenticationPolicyView } from '../../../../application/projections/authentication-policy/authentication-policy-view.projection.js';
import { UpdateAuthenticationPolicy } from '../../../../application/use-cases/commands/authentication-policy/update-authentication-policy/update-authentication-policy.use-case.js';
import { GetAuthenticationPolicy } from '../../../../application/use-cases/queries/authentication-policy/get-authentication-policy/get-authentication-policy.use-case.js';
import { UpdateAuthenticationPolicyBody } from '../../dto/input/authentication-policy/update-authentication-policy-body.dto.js';
import { UpdateAuthenticationPolicyQuery } from '../../dto/input/authentication-policy/update-authentication-policy-query.dto.js';
import { toAuthenticationPolicy } from '../../mappers/authentication-policy/authentication-policy.mapper.js';

/**
 * Function caller
 *
 * @description
 * The actor and the organization of the verified internal token, the current organization of the
 * session; the guard already refused a token without them.
 *
 * @returns {{ readonly userId: string; readonly organizationId: string }} The caller.
 * @throws {ProblemException} `403 auth.actor-not-allowed` or `403 auth.organization-required`.
 */
function caller(): { readonly userId: string; readonly organizationId: string } {
  const context: OrganizationContext | undefined = getOrganizationContext();
  if (context?.actor.type !== 'user' || context.actor.id === null) {
    throw new ProblemException({ status: 403, code: 'auth.actor-not-allowed' });
  }
  if (context.organizationId === null) {
    throw new ProblemException({ status: 403, code: 'auth.organization-required' });
  }
  return { userId: context.actor.id, organizationId: context.organizationId };
}

/**
 * Function answerPolicyRefusals
 *
 * @description
 * Runs a use case of the policy, sets the `ETag` of its answer, and maps its refusals to the
 * problems of the contract (`PolicyAccessRefused`, `OrganizationOrSessionNotFound`,
 * `TwoStepNotEnabled`, `VersionMismatch`).
 *
 * @param {Response} response - The response, for `ETag`.
 * @param {() => Promise<AuthenticationPolicyView>} work - The call of the use case.
 * @returns {Promise<AuthenticationPolicy>} The body of the response.
 * @throws {ProblemException} For a refusal.
 */
async function answerPolicyRefusals(
  response: Response,
  work: () => Promise<AuthenticationPolicyView>,
): Promise<AuthenticationPolicy> {
  try {
    const view: AuthenticationPolicyView = await work();
    response.setHeader('ETag', `"${String(view.version)}"`);
    return toAuthenticationPolicy(view);
  } catch (error) {
    if (!(error instanceof AuthenticationPolicyRefusal)) {
      throw error;
    }
    switch (error.reason) {
      case 'organization-not-found':
        throw new ProblemException({ status: 404, code: 'organization.not-found' });
      case 'role-forbidden':
        throw new ProblemException({ status: 403, code: 'organization.role-forbidden' });
      case 'version-mismatch':
        throw new ProblemException({
          status: 412,
          code: 'request.version-mismatch',
          details: { version: error.version },
        });
      case 'two-step-not-enabled':
        throw new ProblemException({ status: 409, code: 'auth.two-step-not-enabled' });
      case 'reauthentication-required':
        throw new ProblemException({
          status: 403,
          code: 'auth.reauthentication-required',
          details: {
            methods: error.twoStepVerificationEnabled ? ['authenticator-app'] : ['password'],
          },
        });
      case 'session-not-found':
        throw new ProblemException({ status: 404, code: 'session.not-found' });
    }
  }
}

/**
 * Class AuthenticationPolicyController
 *
 * @description
 * `GET` and `PATCH /internal/v1/organization/authentication-policy` (decision 8 of P2c): the
 * authentication policy of the organization of the internal token, the current one of the session,
 * for its owner and its admins. Internal token of the issuer `api-gateway`, actor `user`,
 * organization required; the use cases run in the tenant transaction of that organization.
 */
@Controller('internal/v1/organization/authentication-policy')
@InternalAccess({ issuers: ['api-gateway'], actors: ['user'], organization: 'required' })
export class AuthenticationPolicyController {
  // #region Properties
  /**
   * Property getAuthenticationPolicy
   *
   * @description
   * Use case of the reading.
   *
   * @type {GetAuthenticationPolicy}
   * @readonly
   */
  private readonly getAuthenticationPolicy: GetAuthenticationPolicy;

  /**
   * Property updateAuthenticationPolicy
   *
   * @description
   * Use case of the change.
   *
   * @type {UpdateAuthenticationPolicy}
   * @readonly
   */
  private readonly updateAuthenticationPolicy: UpdateAuthenticationPolicy;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the use cases, provided by `SessionsModule`.
   *
   * @param {GetAuthenticationPolicy} getAuthenticationPolicy - Use case of the reading.
   * @param {UpdateAuthenticationPolicy} updateAuthenticationPolicy - Use case of the change.
   * @constructor
   */
  public constructor(
    getAuthenticationPolicy: GetAuthenticationPolicy,
    updateAuthenticationPolicy: UpdateAuthenticationPolicy,
  ) {
    this.getAuthenticationPolicy = getAuthenticationPolicy;
    this.updateAuthenticationPolicy = updateAuthenticationPolicy;
  }
  // #endregion

  // #region Methods
  /**
   * Method get
   *
   * @description
   * `GET /internal/v1/organization/authentication-policy`: `200` with the policy and its `ETag`.
   *
   * @param {Response} response - The response, for `ETag`.
   * @returns {Promise<AuthenticationPolicy>} The policy.
   */
  @Get()
  public async get(@Res({ passthrough: true }) response: Response): Promise<AuthenticationPolicy> {
    const { userId, organizationId } = caller();
    return answerPolicyRefusals(response, () =>
      this.getAuthenticationPolicy.execute({ actorUserId: userId, organizationId }),
    );
  }

  /**
   * Method update
   *
   * @description
   * `PATCH /internal/v1/organization/authentication-policy?sessionId=`: `200` with the policy after
   * the patch and its `ETag`. A malformed `If-Match` answers `400 request.invalid` through
   * `parseIfMatch`; `*` matches any version.
   *
   * @param {UpdateAuthenticationPolicyQuery} query - The session of the public request.
   * @param {UpdateAuthenticationPolicyBody} body - The patch.
   * @param {string | undefined} ifMatch - The `If-Match` header, if any.
   * @param {Response} response - The response, for `ETag`.
   * @returns {Promise<AuthenticationPolicy>} The policy after the change.
   */
  @Patch()
  public async update(
    @Query() query: UpdateAuthenticationPolicyQuery,
    @Body() body: UpdateAuthenticationPolicyBody,
    @Headers('if-match') ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthenticationPolicy> {
    const { userId, organizationId } = caller();
    const condition: IfMatchCondition = parseIfMatch(ifMatch);
    const expectedVersions: readonly number[] | null =
      condition === undefined || condition === '*' ? null : condition;
    return answerPolicyRefusals(response, () =>
      this.updateAuthenticationPolicy.execute({
        actorUserId: userId,
        organizationId,
        sessionId: query.sessionId,
        expectedVersions,
        ...(body.twoStepVerificationRequiredFor === undefined
          ? {}
          : { twoStepVerificationRequiredFor: body.twoStepVerificationRequiredFor }),
        ...(body.sessionInactivityTimeoutMinutes === undefined
          ? {}
          : { sessionInactivityTimeoutMinutes: body.sessionInactivityTimeoutMinutes }),
      }),
    );
  }
  // #endregion
}
