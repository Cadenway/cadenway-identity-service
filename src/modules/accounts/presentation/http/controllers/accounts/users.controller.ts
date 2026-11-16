import type { User } from '@cadenway/contracts/types/internal/identity-service';
import { GetUserParams } from '@cadenway/contracts/validators/internal/identity-service';
import {
  getOrganizationContext,
  InternalAccess,
  ProblemException,
  zodDto,
} from '@cadenway/nest-common';
import type { OrganizationContext } from '@cadenway/nest-common';
import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';

import type { AccountView } from '../../../../application/projections/accounts/account-view.projection.js';
import { GetUser } from '../../../../application/use-cases/queries/accounts/get-user/get-user.use-case.js';
import { answerRefusals } from '../../errors/authentication/account-refusal.problem.js';

/**
 * Class GetUserPath
 *
 * @description
 * Path of `GET /internal/v1/users/{userId}`: a UUID, else `400 request.invalid`.
 */
class GetUserPath extends zodDto(GetUserParams) {}

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
 * Class UsersController
 *
 * @description
 * `GET /internal/v1/users/{userId}`, which the gateway calls for `GET /v1/me` with the user the
 * introspection returned. It accepts the issuer `api-gateway` only, with the actor `user` and no
 * organization. The user comes from the verified internal token, never from the request: another
 * id, or an unknown one, answers `404 user.not-found`. The `ETag` (`"<version>"`) is set by the
 * `EtagInterceptor` of the kit from the `version` of the body.
 */
@Controller('internal/v1/users')
@InternalAccess({ issuers: ['api-gateway'], actors: ['user'], organization: 'optional' })
export class UsersController {
  // #region Properties
  /**
   * Property getUser
   *
   * @description
   * Use case of the reading.
   *
   * @type {GetUser}
   * @readonly
   */
  private readonly getUser: GetUser;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the use case, provided by `AccountsModule`.
   *
   * @param {GetUser} getUser - Use case of the reading.
   * @constructor
   */
  public constructor(getUser: GetUser) {
    this.getUser = getUser;
  }
  // #endregion

  // #region Methods
  /**
   * Method read
   *
   * @description
   * `GET /internal/v1/users/{userId}`: `200` with the account of the actor, `404` otherwise.
   *
   * @param {GetUserPath} path - The id of the account.
   * @param {Response} response - The response of the refusals.
   * @returns {Promise<User>} The account.
   */
  @Get(':userId')
  public async read(
    @Param() path: GetUserPath,
    @Res({ passthrough: true }) response: Response,
  ): Promise<User> {
    const actor: string = actorUserId();
    const view: AccountView = await answerRefusals(response, () =>
      this.getUser.execute({ actorUserId: actor, userId: path.userId }),
    );
    return {
      id: view.id,
      name: view.name,
      email: view.email,
      language: view.language,
      version: view.version,
    };
  }
  // #endregion
}
