import type { ApiTokenIntrospection } from '@cadenway/contracts/types/internal/identity-service';
import { InternalAccess } from '@cadenway/nest-common';
import { Body, Controller, HttpCode, Post } from '@nestjs/common';

import type { IntrospectApiTokenOutput } from '../../../../application/use-cases/commands/api-token/introspect-api-token/introspect-api-token.output.js';
import { IntrospectApiToken } from '../../../../application/use-cases/commands/api-token/introspect-api-token/introspect-api-token.use-case.js';
import { IntrospectApiTokenBody } from '../../dto/input/api-token-introspection/introspect-api-token-body.dto.js';

/**
 * Class ApiTokenIntrospectionController
 *
 * @description
 * `POST /internal/v1/api-tokens/introspect`, which the gateway calls on every request that carries
 * `Authorization: Bearer`. It accepts the issuer `api-gateway` only, with the actor `system` (the
 * gateway acting as itself) and no organization. An unknown, revoked or expired token, one whose
 * user left its organization, and a malformed value answer `200` with `active: false`, never an
 * error.
 */
@Controller('internal/v1/api-tokens')
@InternalAccess({ issuers: ['api-gateway'], actors: ['system'], organization: 'optional' })
export class ApiTokenIntrospectionController {
  // #region Properties
  /**
   * Property introspectApiToken
   *
   * @description
   * Use case of the introspection.
   *
   * @type {IntrospectApiToken}
   * @readonly
   */
  private readonly introspectApiToken: IntrospectApiToken;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the use case, provided by `ApiTokensModule`.
   *
   * @param {IntrospectApiToken} introspectApiToken - Use case of the introspection.
   * @constructor
   */
  public constructor(introspectApiToken: IntrospectApiToken) {
    this.introspectApiToken = introspectApiToken;
  }
  // #endregion

  // #region Methods
  /**
   * Method introspect
   *
   * @description
   * `POST /internal/v1/api-tokens/introspect`: `200` with whether the token is active.
   *
   * @param {IntrospectApiTokenBody} body - The bearer token.
   * @returns {Promise<ApiTokenIntrospection>} The introspection.
   */
  @Post('introspect')
  @HttpCode(200)
  public async introspect(@Body() body: IntrospectApiTokenBody): Promise<ApiTokenIntrospection> {
    const view: IntrospectApiTokenOutput = await this.introspectApiToken.execute(body);
    if (!view.active) {
      return { active: false };
    }
    return {
      active: true,
      tokenType: view.tokenType,
      apiTokenId: view.apiTokenId,
      userId: view.userId,
      organizationId: view.organizationId,
      role: view.role,
      scopes: [...view.scopes],
      expiresAt: view.expiresAt?.toISOString() ?? null,
    };
  }
  // #endregion
}
