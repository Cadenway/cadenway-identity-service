import type { Introspection } from '@cadenway/contracts/types/internal/identity-service';
import { InternalAccess } from '@cadenway/nest-common';
import { Body, Controller, HttpCode, Post } from '@nestjs/common';

import type { IntrospectTokenOutput } from '../../../../application/use-cases/commands/session/introspect-token/introspect-token.output.js';
import { IntrospectToken } from '../../../../application/use-cases/commands/session/introspect-token/introspect-token.use-case.js';
import { IntrospectionBody } from '../../dto/input/token/introspection-body.dto.js';

/**
 * Class TokensController
 *
 * @description
 * `POST /internal/v1/tokens/introspect`, which the gateway calls on every request that carries the
 * session cookie. It accepts the issuer `api-gateway` only, with the actor `system` (the gateway
 * acting as itself) and no organization. An unknown, expired, revoked or malformed token answers
 * `200` with `active: false`, never an error.
 */
@Controller('internal/v1/tokens')
@InternalAccess({ issuers: ['api-gateway'], actors: ['system'], organization: 'optional' })
export class TokensController {
  // #region Properties
  /**
   * Property introspectToken
   *
   * @description
   * Use case of the introspection.
   *
   * @type {IntrospectToken}
   * @readonly
   */
  private readonly introspectToken: IntrospectToken;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the use case, provided by `SessionsModule`.
   *
   * @param {IntrospectToken} introspectToken - Use case of the introspection.
   * @constructor
   */
  public constructor(introspectToken: IntrospectToken) {
    this.introspectToken = introspectToken;
  }
  // #endregion

  // #region Methods
  /**
   * Method introspect
   *
   * @description
   * `POST /internal/v1/tokens/introspect`: `200` with whether the token is active.
   *
   * @param {IntrospectionBody} body - The value of the cookie.
   * @returns {Promise<Introspection>} The introspection.
   */
  @Post('introspect')
  @HttpCode(200)
  public async introspect(@Body() body: IntrospectionBody): Promise<Introspection> {
    const view: IntrospectTokenOutput = await this.introspectToken.execute(body);
    if (!view.active) {
      return { active: false };
    }
    return {
      active: true,
      tokenType: view.tokenType,
      sessionId: view.sessionId,
      userId: view.userId,
      organizationId: view.organizationId,
      role: view.role,
      scopes: [...view.scopes],
      expiresAt: view.expiresAt.toISOString(),
      ...(view.withheldOrganizationId === null
        ? {}
        : {
            withheldOrganization: {
              organizationId: view.withheldOrganizationId,
              code: 'organization.mfa-required',
            },
          }),
    };
  }
  // #endregion
}
