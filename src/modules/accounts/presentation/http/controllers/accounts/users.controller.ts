import type { User } from '@cadenway/contracts/types/internal/identity-service';
import { GetUserParams } from '@cadenway/contracts/validators/internal/identity-service';
import {
  getOrganizationContext,
  InternalAccess,
  parseIfMatch,
  ProblemException,
  zodDto,
} from '@cadenway/nest-common';
import type { IfMatchCondition, OrganizationContext } from '@cadenway/nest-common';
import { Body, Controller, Get, Headers, Param, Patch, Res } from '@nestjs/common';
import type { Response } from 'express';

import type { AccountView } from '../../../../application/projections/accounts/account-view.projection.js';
import { UpdateUserProfile } from '../../../../application/use-cases/commands/accounts/update-user-profile/update-user-profile.use-case.js';
import { GetUser } from '../../../../application/use-cases/queries/accounts/get-user/get-user.use-case.js';
import { UpdateUserBody } from '../../dto/input/accounts/update-user-body.dto.js';
import { answerRefusals } from '../../errors/authentication/account-refusal.problem.js';
import { toUser } from '../../mappers/accounts/user.mapper.js';

/**
 * Class UserPath
 *
 * @description
 * Path of `GET` and `PATCH /internal/v1/users/{userId}`: a UUID, else `400 request.invalid`.
 */
class UserPath extends zodDto(GetUserParams) {}

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
 * Function expectedVersionsOf
 *
 * @description
 * The versions an `If-Match` header accepts, read with `parseIfMatch` of the kit: `null` without a
 * header or for `*`, which any existing account matches. A header that is not a list of entity
 * tags answers `400 request.invalid` with an issue on `If-Match`, the code the contract declares.
 *
 * @param {string | undefined} header - The `If-Match` header.
 * @returns {readonly number[] | null} The accepted versions, or `null` without a condition.
 * @throws {ProblemException} `400 request.invalid` for a malformed header.
 */
function expectedVersionsOf(header: string | undefined): readonly number[] | null {
  let condition: IfMatchCondition;
  try {
    condition = parseIfMatch(header);
  } catch {
    throw new ProblemException({
      status: 400,
      code: 'request.invalid',
      detail: 'The request does not match its contract.',
      details: {
        issues: [
          {
            in: 'header',
            path: 'If-Match',
            code: 'invalid_format',
            message: 'Expected an entity tag such as "3".',
          },
        ],
      },
    });
  }
  return condition === undefined || condition === '*' ? null : condition;
}

/**
 * Class UsersController
 *
 * @description
 * `GET /internal/v1/users/{userId}` and `PATCH /internal/v1/users/{userId}`, which the gateway calls
 * for `GET` and `PATCH /v1/me` with the user the introspection returned. They accept the issuer
 * `api-gateway` only, with the actor `user` and no organization. The user comes from the verified
 * internal token, never from the request: another id, or an unknown one, answers
 * `404 user.not-found`. The `ETag` (`"<version>"`) is set by the `EtagInterceptor` of the kit from
 * the `version` of the body.
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

  /**
   * Property updateUserProfile
   *
   * @description
   * Use case of the profile change.
   *
   * @type {UpdateUserProfile}
   * @readonly
   */
  private readonly updateUserProfile: UpdateUserProfile;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the use cases, provided by `AccountsModule`.
   *
   * @param {GetUser} getUser - Use case of the reading.
   * @param {UpdateUserProfile} updateUserProfile - Use case of the profile change.
   * @constructor
   */
  public constructor(getUser: GetUser, updateUserProfile: UpdateUserProfile) {
    this.getUser = getUser;
    this.updateUserProfile = updateUserProfile;
  }
  // #endregion

  // #region Methods
  /**
   * Method read
   *
   * @description
   * `GET /internal/v1/users/{userId}`: `200` with the account of the actor, `404` otherwise.
   *
   * @param {UserPath} path - The id of the account.
   * @param {Response} response - The response of the refusals.
   * @returns {Promise<User>} The account.
   */
  @Get(':userId')
  public async read(
    @Param() path: UserPath,
    @Res({ passthrough: true }) response: Response,
  ): Promise<User> {
    const actor: string = actorUserId();
    const view: AccountView = await answerRefusals(response, () =>
      this.getUser.execute({ actorUserId: actor, userId: path.userId }),
    );
    return toUser(view);
  }

  /**
   * Method update
   *
   * @description
   * `PATCH /internal/v1/users/{userId}`: `200` with the account after the merge patch, the same
   * version when nothing changed; `404 user.not-found` for another or an unknown account;
   * `412 request.version-mismatch` with `details.version` when `If-Match` names another version.
   *
   * @param {UserPath} path - The id of the account.
   * @param {UpdateUserBody} body - The merge patch.
   * @param {string | undefined} ifMatch - The `If-Match` header, optional.
   * @param {Response} response - The response of the refusals.
   * @returns {Promise<User>} The account after the change.
   */
  @Patch(':userId')
  public async update(
    @Param() path: UserPath,
    @Body() body: UpdateUserBody,
    @Headers('if-match') ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<User> {
    const actor: string = actorUserId();
    const expectedVersions: readonly number[] | null = expectedVersionsOf(ifMatch);
    const view: AccountView = await answerRefusals(response, () =>
      this.updateUserProfile.execute({
        actorUserId: actor,
        userId: path.userId,
        expectedVersions,
        patch: {
          ...(body.name === undefined ? {} : { name: body.name }),
          ...(body.displayName === undefined ? {} : { displayName: body.displayName }),
          ...(body.jobTitle === undefined ? {} : { jobTitle: body.jobTitle }),
          ...(body.timeZone === undefined ? {} : { timeZone: body.timeZone }),
          ...(body.language === undefined ? {} : { language: body.language }),
        },
      }),
    );
    return toUser(view);
  }
  // #endregion
}
