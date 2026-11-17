import type {
  DeletionScheduled,
  EmailChangeCodeSent,
  User,
} from '@cadenway/contracts/types/internal/identity-service';
import { getOrganizationContext, InternalAccess, ProblemException } from '@cadenway/nest-common';
import type { OrganizationContext } from '@cadenway/nest-common';
import { Body, Controller, HttpCode, Param, Post, Put, Res } from '@nestjs/common';
import type { Response } from 'express';

import type { ScheduleAccountDeletionOutput } from '../../../../application/use-cases/commands/deletion/schedule-account-deletion/schedule-account-deletion.output.js';
import { ScheduleAccountDeletion } from '../../../../application/use-cases/commands/deletion/schedule-account-deletion/schedule-account-deletion.use-case.js';
import { ConfirmEmailChange } from '../../../../application/use-cases/commands/email-change/confirm-email-change/confirm-email-change.use-case.js';
import { RequestEmailChange } from '../../../../application/use-cases/commands/email-change/request-email-change/request-email-change.use-case.js';
import { ChangePassword } from '../../../../application/use-cases/commands/password/change-password/change-password.use-case.js';
import { AccountPath } from '../../dto/input/accounts/account-path.dto.js';
import { ChangePasswordBody } from '../../dto/input/accounts/change-password-body.dto.js';
import { ConfirmEmailChangeBody } from '../../dto/input/accounts/confirm-email-change-body.dto.js';
import { RequestEmailChangeBody } from '../../dto/input/accounts/request-email-change-body.dto.js';
import { ScheduleAccountDeletionBody } from '../../dto/input/accounts/schedule-account-deletion-body.dto.js';
import { answerRefusals } from '../../errors/authentication/account-refusal.problem.js';
import { toUser } from '../../mappers/accounts/user.mapper.js';
import { toCodeSent } from '../../mappers/authentication/code-sent.mapper.js';

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
 * Class AccountSecurityController
 *
 * @description
 * The security of the account of the signed-in user ("Sécurité" of the account):
 * `PUT /internal/v1/users/{userId}/password`, `POST /internal/v1/users/{userId}/email-change` and
 * its `/confirmation`, and `POST /internal/v1/users/{userId}/deletion`, with the user and the
 * session the introspection returned. Issuer `api-gateway` only, actor `user`, no organization (one
 * the token may carry is ignored); the user comes from the verified internal token, the session
 * from the body, checked against it. The `ETag` of the answers that carry the account is set by the
 * `EtagInterceptor` of the kit.
 */
@Controller('internal/v1/users')
@InternalAccess({ issuers: ['api-gateway'], actors: ['user'], organization: 'optional' })
export class AccountSecurityController {
  // #region Properties
  /**
   * Property changePassword
   *
   * @description
   * Use case of the change of password.
   *
   * @type {ChangePassword}
   * @readonly
   */
  private readonly changePassword: ChangePassword;

  /**
   * Property requestEmailChange
   *
   * @description
   * Use case of the request of a change of address.
   *
   * @type {RequestEmailChange}
   * @readonly
   */
  private readonly requestEmailChange: RequestEmailChange;

  /**
   * Property confirmEmailChange
   *
   * @description
   * Use case of the confirmation of a new address.
   *
   * @type {ConfirmEmailChange}
   * @readonly
   */
  private readonly confirmEmailChange: ConfirmEmailChange;

  /**
   * Property scheduleAccountDeletion
   *
   * @description
   * Use case of the scheduling of the deletion.
   *
   * @type {ScheduleAccountDeletion}
   * @readonly
   */
  private readonly scheduleAccountDeletion: ScheduleAccountDeletion;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the use cases, provided by `AccountsModule`.
   *
   * @param {ChangePassword} changePassword - Use case of the change of password.
   * @param {RequestEmailChange} requestEmailChange - Use case of the request of a change of address.
   * @param {ConfirmEmailChange} confirmEmailChange - Use case of the confirmation of a new address.
   * @param {ScheduleAccountDeletion} scheduleAccountDeletion - Use case of the scheduling of the
   * deletion.
   * @constructor
   */
  public constructor(
    changePassword: ChangePassword,
    requestEmailChange: RequestEmailChange,
    confirmEmailChange: ConfirmEmailChange,
    scheduleAccountDeletion: ScheduleAccountDeletion,
  ) {
    this.changePassword = changePassword;
    this.requestEmailChange = requestEmailChange;
    this.confirmEmailChange = confirmEmailChange;
    this.scheduleAccountDeletion = scheduleAccountDeletion;
  }
  // #endregion

  // #region Methods
  /**
   * Method password
   *
   * @description
   * `PUT /internal/v1/users/{userId}/password`: the account after the change; `404 user.not-found`
   * or `session.not-found`, `422 auth.password-too-short`, `auth.password-compromised` or
   * `auth.password-incorrect`, `429 auth.account-locked` with `Retry-After`.
   *
   * @param {AccountPath} path - The account.
   * @param {ChangePasswordBody} body - The session, both passwords and the browser.
   * @param {Response} response - The response, for `Retry-After`.
   * @returns {Promise<User>} The account after the change.
   */
  @Put(':userId/password')
  @HttpCode(200)
  public async password(
    @Param() path: AccountPath,
    @Body() body: ChangePasswordBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<User> {
    const actor: string = actorUserId();
    return toUser(
      await answerRefusals(response, () =>
        this.changePassword.execute({
          actorUserId: actor,
          userId: path.userId,
          sessionId: body.sessionId,
          currentPassword: body.currentPassword,
          newPassword: body.newPassword,
          client: body.client,
        }),
      ),
    );
  }

  /**
   * Method emailChange
   *
   * @description
   * `POST /internal/v1/users/{userId}/email-change`: `202` once the code is issued to the new
   * address; `403 auth.reauthentication-required`, `404 user.not-found` or `session.not-found`,
   * `409 auth.email-taken`, `422 auth.email-unchanged`, `429 auth.code-throttled`.
   *
   * @param {AccountPath} path - The account.
   * @param {RequestEmailChangeBody} body - The session and the new address.
   * @param {Response} response - The response, for `Retry-After`.
   * @returns {Promise<EmailChangeCodeSent>} The new address, the expiry and the next request.
   */
  @Post(':userId/email-change')
  @HttpCode(202)
  public async emailChange(
    @Param() path: AccountPath,
    @Body() body: RequestEmailChangeBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<EmailChangeCodeSent> {
    const actor: string = actorUserId();
    return toCodeSent(
      await answerRefusals(response, () =>
        this.requestEmailChange.execute({
          actorUserId: actor,
          userId: path.userId,
          sessionId: body.sessionId,
          email: body.email,
        }),
      ),
    );
  }

  /**
   * Method emailChangeConfirmation
   *
   * @description
   * `POST /internal/v1/users/{userId}/email-change/confirmation`: the account with its new address;
   * `404 user.not-found` or `session.not-found`, `409 auth.email-taken`, `422 auth.code-invalid`
   * or `auth.code-expired`.
   *
   * @param {AccountPath} path - The account.
   * @param {ConfirmEmailChangeBody} body - The session, the code and the browser.
   * @param {Response} response - The response.
   * @returns {Promise<User>} The account after the change.
   */
  @Post(':userId/email-change/confirmation')
  @HttpCode(200)
  public async emailChangeConfirmation(
    @Param() path: AccountPath,
    @Body() body: ConfirmEmailChangeBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<User> {
    const actor: string = actorUserId();
    return toUser(
      await answerRefusals(response, () =>
        this.confirmEmailChange.execute({
          actorUserId: actor,
          userId: path.userId,
          sessionId: body.sessionId,
          code: body.code,
          client: body.client,
        }),
      ),
    );
  }

  /**
   * Method deletion
   *
   * @description
   * `POST /internal/v1/users/{userId}/deletion`: `202` with `deleteAt`, every session and token
   * revoked; `409 account.organization-owner` with `details.organizationIds`,
   * `403 auth.reauthentication-required`, `404 user.not-found` or `session.not-found`.
   *
   * @param {AccountPath} path - The account.
   * @param {ScheduleAccountDeletionBody} body - The session of the request.
   * @param {Response} response - The response.
   * @returns {Promise<DeletionScheduled>} When the deletion takes effect.
   */
  @Post(':userId/deletion')
  @HttpCode(202)
  public async deletion(
    @Param() path: AccountPath,
    @Body() body: ScheduleAccountDeletionBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DeletionScheduled> {
    const actor: string = actorUserId();
    const scheduled: ScheduleAccountDeletionOutput = await answerRefusals(response, () =>
      this.scheduleAccountDeletion.execute({
        actorUserId: actor,
        userId: path.userId,
        sessionId: body.sessionId,
      }),
    );
    return { deleteAt: scheduled.deleteAt.toISOString() };
  }
  // #endregion
}
