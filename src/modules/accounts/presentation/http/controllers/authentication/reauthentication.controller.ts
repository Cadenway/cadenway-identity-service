import type { RecentAuthentication } from '@cadenway/contracts/types/internal/identity-service';
import { getOrganizationContext, InternalAccess, ProblemException } from '@cadenway/nest-common';
import type { OrganizationContext } from '@cadenway/nest-common';
import { Body, Controller, HttpCode, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';

import type { RecentAuthentication as RecentAuthenticationModel } from '../../../../application/models/sessions/recent-authentication.model.js';
import { Reauthenticate } from '../../../../application/use-cases/commands/authentication/reauthenticate/reauthenticate.use-case.js';
import { ReauthenticateBody } from '../../dto/input/authentication/reauthenticate-body.dto.js';
import { ReauthenticatePath } from '../../dto/input/authentication/reauthenticate-path.dto.js';
import { answerRefusals } from '../../errors/authentication/account-refusal.problem.js';

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
 * Class ReauthenticationController
 *
 * @description
 * `POST /internal/v1/sessions/{sessionId}/reauthentication`, for `POST /v1/auth/reauthentication`,
 * with the session the introspection returned. The check of the password or of the code of the
 * authenticator app, and their lockouts, belong to the accounts module, which records the recent authentication through the sessions module. Issuer
 * `api-gateway` only, actor `user`, no organization (one the token may carry is ignored).
 */
@Controller('internal/v1/sessions')
@InternalAccess({ issuers: ['api-gateway'], actors: ['user'], organization: 'optional' })
export class ReauthenticationController {
  // #region Properties
  /**
   * Property reauthenticate
   *
   * @description
   * Use case of the confirmation of the password.
   *
   * @type {Reauthenticate}
   * @readonly
   */
  private readonly reauthenticate: Reauthenticate;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the use case, provided by `AccountsModule`.
   *
   * @param {Reauthenticate} reauthenticate - Use case of the confirmation of the password.
   * @constructor
   */
  public constructor(reauthenticate: Reauthenticate) {
    this.reauthenticate = reauthenticate;
  }
  // #endregion

  // #region Methods
  /**
   * Method confirm
   *
   * @description
   * Confirms the password or the code: the window of recent authentication; `400 request.invalid`
   * for both or neither, `403 auth.reauthentication-required` for a password of an account with
   * two-step verification, `404 session.not-found`, `409 auth.two-step-not-enabled`,
   * `422 auth.password-incorrect` or `auth.two-step-code-invalid`, `429 auth.account-locked` or
   * `auth.two-step-locked` with `Retry-After`.
   *
   * @param {ReauthenticatePath} path - The session of the request.
   * @param {ReauthenticateBody} body - The password or the code.
   * @param {Response} response - The response, for `Retry-After`.
   * @returns {Promise<RecentAuthentication>} The recent authentication and when it ends.
   */
  @Post(':sessionId/reauthentication')
  @HttpCode(200)
  public async confirm(
    @Param() path: ReauthenticatePath,
    @Body() body: ReauthenticateBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RecentAuthentication> {
    const actor: string = actorUserId();
    const recent: RecentAuthenticationModel = await answerRefusals(response, () =>
      this.reauthenticate.execute({
        actorUserId: actor,
        sessionId: path.sessionId,
        password: body.password ?? null,
        code: body.code ?? null,
      }),
    );
    return {
      authenticatedAt: recent.authenticatedAt.toISOString(),
      expiresAt: recent.expiresAt.toISOString(),
    };
  }
  // #endregion
}
