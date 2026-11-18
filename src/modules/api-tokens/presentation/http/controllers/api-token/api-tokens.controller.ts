import type {
  ApiTokenCreated,
  ApiTokenPage,
} from '@cadenway/contracts/types/internal/identity-service';
import { getOrganizationContext, InternalAccess, ProblemException } from '@cadenway/nest-common';
import type { OrganizationContext } from '@cadenway/nest-common';
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

import { ApiTokenNotFound } from '../../../../application/models/api-token/api-token-not-found.model.js';
import { ReauthenticationRequired } from '../../../../application/models/api-token/reauthentication-required.model.js';
import { SessionNotFound } from '../../../../application/models/api-token/session-not-found.model.js';
import type { CreateApiTokenOutput } from '../../../../application/use-cases/commands/api-token/create-api-token/create-api-token.output.js';
import { CreateApiToken } from '../../../../application/use-cases/commands/api-token/create-api-token/create-api-token.use-case.js';
import { RevokeApiToken } from '../../../../application/use-cases/commands/api-token/revoke-api-token/revoke-api-token.use-case.js';
import type { ListApiTokensOutput } from '../../../../application/use-cases/queries/api-token/list-api-tokens/list-api-tokens.output.js';
import { ListApiTokens } from '../../../../application/use-cases/queries/api-token/list-api-tokens/list-api-tokens.use-case.js';
import { CreateApiTokenBody } from '../../dto/input/api-token/create-api-token-body.dto.js';
import { ListApiTokensQuery } from '../../dto/input/api-token/list-api-tokens-query.dto.js';
import { RevokeApiTokenPath } from '../../dto/input/api-token/revoke-api-token-path.dto.js';
import { toCursor, toPosition } from '../../mappers/api-token/api-token-cursor.mapper.js';
import { toApiToken } from '../../mappers/api-token/api-token.mapper.js';

/**
 * Interface Caller
 *
 * @description
 * The user and the organization of the verified internal token.
 */
interface Caller {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * The user.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property organizationId
   *
   * @description
   * The current organization of the session.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;
  // #endregion
}

/**
 * Function caller
 *
 * @description
 * The user and the organization the verified internal token acts for. The guard has already
 * refused any other actor and a token without an organization, so a missing one here is a defect
 * of the wiring, answered like the guard would.
 *
 * @returns {Caller} The user and the organization.
 * @throws {ProblemException} `403 auth.actor-not-allowed` or `403 auth.organization-required`.
 */
function caller(): Caller {
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
 * Class ApiTokensController
 *
 * @description
 * The personal API tokens of `openapi/internal/identity-service.yaml`, which the gateway calls for
 * `POST`, `GET /v1/api-tokens` and `DELETE /v1/api-tokens/{apiTokenId}`. They accept the issuer
 * `api-gateway` only, with the actor `user` and an organization, the current one of the session:
 * the guard answers `403 auth.organization-required` without one. The user and the organization
 * come from the verified internal token, never from the request. Nothing here logs a secret.
 */
@Controller('internal/v1/api-tokens')
@InternalAccess({ issuers: ['api-gateway'], actors: ['user'], organization: 'required' })
export class ApiTokensController {
  // #region Properties
  /**
   * Property createApiToken
   *
   * @description
   * Use case of the creation.
   *
   * @type {CreateApiToken}
   * @readonly
   */
  private readonly createApiToken: CreateApiToken;

  /**
   * Property listApiTokens
   *
   * @description
   * Use case of the list.
   *
   * @type {ListApiTokens}
   * @readonly
   */
  private readonly listApiTokens: ListApiTokens;

  /**
   * Property revokeApiToken
   *
   * @description
   * Use case of the revocation.
   *
   * @type {RevokeApiToken}
   * @readonly
   */
  private readonly revokeApiToken: RevokeApiToken;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the use cases, provided by `ApiTokensModule`.
   *
   * @param {CreateApiToken} createApiToken - Use case of the creation.
   * @param {ListApiTokens} listApiTokens - Use case of the list.
   * @param {RevokeApiToken} revokeApiToken - Use case of the revocation.
   * @constructor
   */
  public constructor(
    createApiToken: CreateApiToken,
    listApiTokens: ListApiTokens,
    revokeApiToken: RevokeApiToken,
  ) {
    this.createApiToken = createApiToken;
    this.listApiTokens = listApiTokens;
    this.revokeApiToken = revokeApiToken;
  }
  // #endregion

  // #region Methods
  /**
   * Method create
   *
   * @description
   * `POST /internal/v1/api-tokens`: `201` with the token and its secret, once, and `Location`. The
   * session of the request needs a recent authentication: without one, or without `sessionId`,
   * `403 auth.reauthentication-required` with `details.methods`; a session that is not an open
   * session of the actor, `404 session.not-found`.
   *
   * @param {CreateApiTokenBody} body - The session, the name, the scopes and the lifetime.
   * @param {Response} response - The response, for `Location`.
   * @returns {Promise<ApiTokenCreated>} The token and its secret.
   * @throws {ProblemException} `403 auth.reauthentication-required` or `404 session.not-found`.
   */
  @Post()
  @HttpCode(201)
  public async create(
    @Body() body: CreateApiTokenBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiTokenCreated> {
    const { userId, organizationId } = caller();
    let created: CreateApiTokenOutput;
    try {
      created = await this.createApiToken.execute({
        actorUserId: userId,
        organizationId,
        sessionId: body.sessionId ?? null,
        name: body.name,
        scopes: body.scopes,
        expiration: body.expiration,
      });
    } catch (error) {
      if (error instanceof ReauthenticationRequired) {
        throw new ProblemException({
          status: 403,
          code: 'auth.reauthentication-required',
          details: {
            methods: error.twoStepVerificationEnabled ? ['authenticator-app'] : ['password'],
          },
        });
      }
      if (error instanceof SessionNotFound) {
        throw new ProblemException({ status: 404, code: 'session.not-found' });
      }
      throw error;
    }
    response.setHeader('Location', `/internal/v1/api-tokens/${created.apiToken.id}`);
    return { apiToken: toApiToken(created.apiToken), secret: created.secret };
  }

  /**
   * Method list
   *
   * @description
   * `GET /internal/v1/api-tokens`: `200` with one page of the active tokens of the caller.
   *
   * @param {ListApiTokensQuery} query - The cursor and the page size.
   * @returns {Promise<ApiTokenPage>} The page.
   * @throws {ProblemException} `400 request.invalid` for a cursor that is not one of this list.
   */
  @Get()
  public async list(@Query() query: ListApiTokensQuery): Promise<ApiTokenPage> {
    const { userId, organizationId } = caller();
    const page: ListApiTokensOutput = await this.listApiTokens.execute({
      actorUserId: userId,
      organizationId,
      after: toPosition(query.cursor),
      limit: query.limit,
    });
    return { items: page.items.map(toApiToken), nextCursor: toCursor(page.next) };
  }

  /**
   * Method revoke
   *
   * @description
   * `DELETE /internal/v1/api-tokens/{apiTokenId}`: `204` once revoked or when it already was,
   * `404 api-token.not-found` for a token of another user or organization, or an unknown id.
   *
   * @param {RevokeApiTokenPath} path - The id of the token.
   * @returns {Promise<void>} Resolves once revoked.
   * @throws {ProblemException} `404 api-token.not-found`.
   */
  @Delete(':apiTokenId')
  @HttpCode(204)
  public async revoke(@Param() path: RevokeApiTokenPath): Promise<void> {
    const { userId, organizationId } = caller();
    try {
      await this.revokeApiToken.execute({
        actorUserId: userId,
        organizationId,
        apiTokenId: path.apiTokenId,
      });
    } catch (error) {
      if (error instanceof ApiTokenNotFound) {
        throw new ProblemException({ status: 404, code: 'api-token.not-found' });
      }
      throw error;
    }
  }
  // #endregion
}
