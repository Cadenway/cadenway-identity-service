import { InternalAccess, ProblemException, getOrganizationContext } from '@cadenway/nest-common';
import type { OrganizationContext } from '@cadenway/nest-common';
import { Controller, Delete, HttpCode, Param } from '@nestjs/common';

import { SessionNotFound } from '../../../../application/models/session/session-not-found.model.js';
import { RevokeSession } from '../../../../application/use-cases/commands/session/revoke-session/revoke-session.use-case.js';
import { RevokeSessionPath } from '../../dto/input/session/revoke-session-path.dto.js';

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
 * `DELETE /internal/v1/sessions/{sessionId}`, which the gateway calls for `POST /v1/auth/sign-out`
 * with the session the introspection returned. It accepts the issuer `api-gateway` only, with the
 * actor `user` and no organization; the user comes from the verified internal token.
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
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the use case, provided by `SessionsModule`.
   *
   * @param {RevokeSession} revokeSession - Use case of the revocation.
   * @constructor
   */
  public constructor(revokeSession: RevokeSession) {
    this.revokeSession = revokeSession;
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
  // #endregion
}
