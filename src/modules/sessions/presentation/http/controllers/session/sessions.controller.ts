import type { SessionOrganization } from '@cadenway/contracts/types/internal/identity-service';
import { InternalAccess, ProblemException, getOrganizationContext } from '@cadenway/nest-common';
import type { OrganizationContext } from '@cadenway/nest-common';
import { Body, Controller, Delete, HttpCode, Param, Put } from '@nestjs/common';

import { OrganizationNotFound } from '../../../../application/models/session/organization-not-found.model.js';
import { SessionNotFound } from '../../../../application/models/session/session-not-found.model.js';
import { RevokeSession } from '../../../../application/use-cases/commands/session/revoke-session/revoke-session.use-case.js';
import type { SwitchSessionOrganizationOutput } from '../../../../application/use-cases/commands/session/switch-session-organization/switch-session-organization.output.js';
import { SwitchSessionOrganization } from '../../../../application/use-cases/commands/session/switch-session-organization/switch-session-organization.use-case.js';
import { RevokeSessionPath } from '../../dto/input/session/revoke-session-path.dto.js';
import { SwitchSessionOrganizationBody } from '../../dto/input/session/switch-session-organization-body.dto.js';
import { SwitchSessionOrganizationPath } from '../../dto/input/session/switch-session-organization-path.dto.js';

/**
 * Function actorUserId
 *
 * @description
 * The user the verified internal token acts for. The guard has already refused any other actor,
 * so a missing user here is a defect of the wiring, answered like the guard would.
 *
 * @returns {string} The id of the user.
 * @throws {ProblemException} `403 auth.actor-not-allowed` without a user actor.
 */
function actorUserId(): string {
  const context: OrganizationContext | undefined = getOrganizationContext();
  if (context?.actor.type !== 'user' || context.actor.id === null) {
    throw new ProblemException({ status: 403, code: 'auth.actor-not-allowed' });
  }
  return context.actor.id;
}

/**
 * Class SessionsController
 *
 * @description
 * The routes of a session of the signed-in user: `DELETE /internal/v1/sessions/{sessionId}`, which
 * the gateway calls for `POST /v1/auth/sign-out`, and
 * `PUT /internal/v1/sessions/{sessionId}/organization`, for `PUT /v1/session/organization`, both
 * with the session the introspection returned. They accept the issuer `api-gateway` only, with the
 * actor `user` and no organization (an organization the token may carry is ignored); the user comes
 * from the verified internal token, never from the request.
 */
@Controller('internal/v1/sessions')
@InternalAccess({ issuers: ['api-gateway'], actors: ['user'], organization: 'optional' })
export class SessionsController {
  // #region Properties
  /**
   * Property revokeSession
   *
   * @description
   * Use case of the revocation.
   *
   * @type {RevokeSession}
   * @readonly
   */
  private readonly revokeSession: RevokeSession;

  /**
   * Property switchSessionOrganization
   *
   * @description
   * Use case of the choice of the current organization.
   *
   * @type {SwitchSessionOrganization}
   * @readonly
   */
  private readonly switchSessionOrganization: SwitchSessionOrganization;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the use cases, provided by `SessionsModule`.
   *
   * @param {RevokeSession} revokeSession - Use case of the revocation.
   * @param {SwitchSessionOrganization} switchSessionOrganization - Use case of the choice of the
   * current organization.
   * @constructor
   */
  public constructor(
    revokeSession: RevokeSession,
    switchSessionOrganization: SwitchSessionOrganization,
  ) {
    this.revokeSession = revokeSession;
    this.switchSessionOrganization = switchSessionOrganization;
  }
  // #endregion

  // #region Methods
  /**
   * Method revoke
   *
   * @description
   * `DELETE /internal/v1/sessions/{sessionId}`: `204` once revoked or when it had already ended,
   * `404 session.not-found` for a session of another user or an unknown id.
   *
   * @param {RevokeSessionPath} path - The id of the session.
   * @returns {Promise<void>} Resolves once revoked.
   * @throws {ProblemException} `404 session.not-found`.
   */
  @Delete(':sessionId')
  @HttpCode(204)
  public async revoke(@Param() path: RevokeSessionPath): Promise<void> {
    try {
      await this.revokeSession.execute({ actorUserId: actorUserId(), sessionId: path.sessionId });
    } catch (error) {
      if (error instanceof SessionNotFound) {
        throw new ProblemException({ status: 404, code: 'session.not-found' });
      }
      throw error;
    }
  }

  /**
   * Method switchOrganization
   *
   * @description
   * `PUT /internal/v1/sessions/{sessionId}/organization`: `200` with the organization and the role
   * of the actor, also when it was already the current one; `404 session.not-found` for a session
   * of another user, an unknown id or a session that ended; `404 organization.not-found` when the
   * copy of the memberships holds no membership of the actor there.
   *
   * @param {SwitchSessionOrganizationPath} path - The id of the session.
   * @param {SwitchSessionOrganizationBody} body - The organization chosen.
   * @returns {Promise<SessionOrganization>} The organization and the role.
   * @throws {ProblemException} `404 session.not-found` or `404 organization.not-found`.
   */
  @Put(':sessionId/organization')
  @HttpCode(200)
  public async switchOrganization(
    @Param() path: SwitchSessionOrganizationPath,
    @Body() body: SwitchSessionOrganizationBody,
  ): Promise<SessionOrganization> {
    let chosen: SwitchSessionOrganizationOutput;
    try {
      chosen = await this.switchSessionOrganization.execute({
        actorUserId: actorUserId(),
        sessionId: path.sessionId,
        organizationId: body.organizationId,
      });
    } catch (error) {
      if (error instanceof SessionNotFound) {
        throw new ProblemException({ status: 404, code: 'session.not-found' });
      }
      if (error instanceof OrganizationNotFound) {
        throw new ProblemException({ status: 404, code: 'organization.not-found' });
      }
      throw error;
    }
    return { organizationId: chosen.organizationId, role: chosen.role };
  }
  // #endregion
}
