import type { OpenSessionPage } from '@cadenway/contracts/types/internal/identity-service';
import { getOrganizationContext, InternalAccess, ProblemException } from '@cadenway/nest-common';
import type { OrganizationContext } from '@cadenway/nest-common';
import { Controller, Get, Param, Query } from '@nestjs/common';

import { SessionNotFound } from '../../../../application/models/session/session-not-found.model.js';
import { UserNotFound } from '../../../../application/models/session/user-not-found.model.js';
import type { ListUserSessionsOutput } from '../../../../application/use-cases/queries/session/list-user-sessions/list-user-sessions.output.js';
import { ListUserSessions } from '../../../../application/use-cases/queries/session/list-user-sessions/list-user-sessions.use-case.js';
import { ListUserSessionsPath } from '../../dto/input/session/list-user-sessions-path.dto.js';
import { ListUserSessionsQuery } from '../../dto/input/session/list-user-sessions-query.dto.js';
import { toOpenSession } from '../../mappers/session/open-session.mapper.js';
import { toSessionCursor, toSessionPosition } from '../../mappers/session/session-cursor.mapper.js';

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
 * Class UserSessionsController
 *
 * @description
 * `GET /internal/v1/users/{userId}/sessions`, for `GET /v1/sessions` ("Sessions actives"), with the
 * user and, as `currentSessionId`, the session the introspection returned. Issuer `api-gateway`
 * only, actor `user`, no organization (one the token may carry is ignored).
 */
@Controller('internal/v1/users')
@InternalAccess({ issuers: ['api-gateway'], actors: ['user'], organization: 'optional' })
export class UserSessionsController {
  // #region Properties
  /**
   * Property listUserSessions
   *
   * @description
   * Use case of the list.
   *
   * @type {ListUserSessions}
   * @readonly
   */
  private readonly listUserSessions: ListUserSessions;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the use case, provided by `SessionsModule`.
   *
   * @param {ListUserSessions} listUserSessions - Use case of the list.
   * @constructor
   */
  public constructor(listUserSessions: ListUserSessions) {
    this.listUserSessions = listUserSessions;
  }
  // #endregion

  // #region Methods
  /**
   * Method list
   *
   * @description
   * One page of the open sessions of the actor. Another user id answers `404 user.not-found`; a
   * `currentSessionId` that is not an open session of the actor, `404 session.not-found`; a cursor
   * that is not one of this list, `400 request.invalid`.
   *
   * @param {ListUserSessionsPath} path - The account.
   * @param {ListUserSessionsQuery} query - The session of the request and the page.
   * @returns {Promise<OpenSessionPage>} The page.
   * @throws {ProblemException} `404 user.not-found`, `404 session.not-found`, `400 request.invalid`.
   */
  @Get(':userId/sessions')
  public async list(
    @Param() path: ListUserSessionsPath,
    @Query() query: ListUserSessionsQuery,
  ): Promise<OpenSessionPage> {
    let page: ListUserSessionsOutput;
    try {
      page = await this.listUserSessions.execute({
        actorUserId: actorUserId(),
        userId: path.userId,
        currentSessionId: query.currentSessionId,
        after: toSessionPosition(query.cursor),
        limit: query.limit,
      });
    } catch (error) {
      if (error instanceof UserNotFound) {
        throw new ProblemException({ status: 404, code: 'user.not-found' });
      }
      if (error instanceof SessionNotFound) {
        throw new ProblemException({ status: 404, code: 'session.not-found' });
      }
      throw error;
    }
    return { items: page.items.map(toOpenSession), nextCursor: toSessionCursor(page.next) };
  }
  // #endregion
}
