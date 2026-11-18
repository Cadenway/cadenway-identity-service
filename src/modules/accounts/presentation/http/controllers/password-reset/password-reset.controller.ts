import type {
  PasswordResetCompleted,
  PasswordResetLink,
  PasswordResetLinkSent,
} from '@cadenway/contracts/types/internal/identity-service';
import { InternalAccess } from '@cadenway/nest-common';
import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';

import { ConfirmPasswordReset } from '../../../../application/use-cases/commands/password-reset/confirm-password-reset/confirm-password-reset.use-case.js';
import { RequestPasswordReset } from '../../../../application/use-cases/commands/password-reset/request-password-reset/request-password-reset.use-case.js';
import { InspectPasswordResetLink } from '../../../../application/use-cases/queries/password-reset/inspect-password-reset-link/inspect-password-reset-link.use-case.js';
import { ConfirmPasswordResetBody } from '../../dto/input/password-reset/confirm-password-reset-body.dto.js';
import { InspectPasswordResetLinkBody } from '../../dto/input/password-reset/inspect-password-reset-link-body.dto.js';
import { RequestPasswordResetBody } from '../../dto/input/password-reset/request-password-reset-body.dto.js';
import { answerRefusals } from '../../errors/authentication/account-refusal.problem.js';
import { toCodeSent } from '../../mappers/authentication/code-sent.mapper.js';
import {
  toPasswordResetCompleted,
  toPasswordResetLink,
} from '../../mappers/password-reset/password-reset.mapper.js';

/**
 * Class PasswordResetController
 *
 * @description
 * The password reset ("Mot de passe oublié", "Choisir un nouveau mot de passe"):
 * `POST /internal/v1/auth/password-reset`, `/inspection` and `/confirmation`, which the gateway calls
 * for the public routes of the same names. They run before any session exists: issuer
 * `api-gateway` only, actor `anonymous`, no organization. The token of a link travels in the bodies
 * only and is never logged.
 */
@Controller('internal/v1/auth/password-reset')
@InternalAccess({ issuers: ['api-gateway'], actors: ['anonymous'], organization: 'optional' })
export class PasswordResetController {
  // #region Properties
  /**
   * Property requestPasswordReset
   *
   * @description
   * Use case of the request of a link.
   *
   * @type {RequestPasswordReset}
   * @readonly
   */
  private readonly requestPasswordReset: RequestPasswordReset;

  /**
   * Property inspectPasswordResetLink
   *
   * @description
   * Use case of the reading of a link.
   *
   * @type {InspectPasswordResetLink}
   * @readonly
   */
  private readonly inspectPasswordResetLink: InspectPasswordResetLink;

  /**
   * Property confirmPasswordReset
   *
   * @description
   * Use case of the new password.
   *
   * @type {ConfirmPasswordReset}
   * @readonly
   */
  private readonly confirmPasswordReset: ConfirmPasswordReset;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the use cases, provided by `AccountsModule`.
   *
   * @param {RequestPasswordReset} requestPasswordReset - Use case of the request of a link.
   * @param {InspectPasswordResetLink} inspectPasswordResetLink - Use case of the reading of a link.
   * @param {ConfirmPasswordReset} confirmPasswordReset - Use case of the new password.
   * @constructor
   */
  public constructor(
    requestPasswordReset: RequestPasswordReset,
    inspectPasswordResetLink: InspectPasswordResetLink,
    confirmPasswordReset: ConfirmPasswordReset,
  ) {
    this.requestPasswordReset = requestPasswordReset;
    this.inspectPasswordResetLink = inspectPasswordResetLink;
    this.confirmPasswordReset = confirmPasswordReset;
  }
  // #endregion

  // #region Methods
  /**
   * Method request
   *
   * @description
   * `POST /internal/v1/auth/password-reset`: `202` the same way whether or not a link was issued;
   * `429 auth.reset-throttled` with `Retry-After`.
   *
   * @param {RequestPasswordResetBody} body - The address and the browser.
   * @param {Response} response - The response, for `Retry-After`.
   * @returns {Promise<PasswordResetLinkSent>} The address, the expiry and the next request.
   */
  @Post()
  @HttpCode(202)
  public async request(
    @Body() body: RequestPasswordResetBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PasswordResetLinkSent> {
    return toCodeSent(
      await answerRefusals(response, () =>
        this.requestPasswordReset.execute({ email: body.email, client: body.client }),
      ),
    );
  }

  /**
   * Method inspect
   *
   * @description
   * `POST /internal/v1/auth/password-reset/inspection`: the account of a usable link, without using
   * it; `422 auth.reset-link-expired` otherwise.
   *
   * @param {InspectPasswordResetLinkBody} body - The token.
   * @param {Response} response - The response.
   * @returns {Promise<PasswordResetLink>} The account of the link.
   */
  @Post('inspection')
  @HttpCode(200)
  public async inspect(
    @Body() body: InspectPasswordResetLinkBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PasswordResetLink> {
    return toPasswordResetLink(
      await answerRefusals(response, () =>
        this.inspectPasswordResetLink.execute({ token: body.token }),
      ),
    );
  }

  /**
   * Method confirm
   *
   * @description
   * `POST /internal/v1/auth/password-reset/confirmation`: sets the new password, never signs in;
   * `422 auth.reset-link-expired`, `auth.password-too-short` or `auth.password-compromised`.
   *
   * @param {ConfirmPasswordResetBody} body - The token, the password, the choice for the sessions
   * and the browser.
   * @param {Response} response - The response.
   * @returns {Promise<PasswordResetCompleted>} The address and the closed sessions.
   */
  @Post('confirmation')
  @HttpCode(200)
  public async confirm(
    @Body() body: ConfirmPasswordResetBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PasswordResetCompleted> {
    return toPasswordResetCompleted(
      await answerRefusals(response, () =>
        this.confirmPasswordReset.execute({
          token: body.token,
          newPassword: body.newPassword,
          closeOtherSessions: body.closeOtherSessions,
          client: body.client,
        }),
      ),
    );
  }
  // #endregion
}
