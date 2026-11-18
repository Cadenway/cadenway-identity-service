import type {
  AuthenticatorAppConfigured,
  AuthenticatorAppSetup,
  BackupCodes,
  SecurityKey,
  SecurityKeyRegistration,
  TwoStepVerification,
} from '@cadenway/contracts/types/internal/identity-service';
import { getOrganizationContext, InternalAccess, ProblemException } from '@cadenway/nest-common';
import type { OrganizationContext } from '@cadenway/nest-common';
import { Body, Controller, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';

import type { SecurityKeyView } from '../../../../application/projections/two-step/security-key-view.projection.js';
import { AddSecurityKey } from '../../../../application/use-cases/commands/two-step/add-security-key/add-security-key.use-case.js';
import { ConfirmAuthenticatorAppSetup } from '../../../../application/use-cases/commands/two-step/confirm-authenticator-app-setup/confirm-authenticator-app-setup.use-case.js';
import { DisableTwoStepVerification } from '../../../../application/use-cases/commands/two-step/disable-two-step-verification/disable-two-step-verification.use-case.js';
import { RegenerateBackupCodes } from '../../../../application/use-cases/commands/two-step/regenerate-backup-codes/regenerate-backup-codes.use-case.js';
import { RemoveSecurityKey } from '../../../../application/use-cases/commands/two-step/remove-security-key/remove-security-key.use-case.js';
import { StartAuthenticatorAppSetup } from '../../../../application/use-cases/commands/two-step/start-authenticator-app-setup/start-authenticator-app-setup.use-case.js';
import { StartSecurityKeyRegistration } from '../../../../application/use-cases/commands/two-step/start-security-key-registration/start-security-key-registration.use-case.js';
import { GetTwoStepVerification } from '../../../../application/use-cases/queries/two-step/get-two-step-verification/get-two-step-verification.use-case.js';
import { AddSecurityKeyBody } from '../../dto/input/two-step/add-security-key-body.dto.js';
import { ConfirmAuthenticatorAppSetupBody } from '../../dto/input/two-step/confirm-authenticator-app-setup-body.dto.js';
import { AddSecurityKeyPath } from '../../dto/input/two-step/add-security-key-path.dto.js';
import { ConfirmAuthenticatorAppSetupPath } from '../../dto/input/two-step/confirm-authenticator-app-setup-path.dto.js';
import { DisableTwoStepVerificationBody } from '../../dto/input/two-step/disable-two-step-verification-body.dto.js';
import { DisableTwoStepVerificationPath } from '../../dto/input/two-step/disable-two-step-verification-path.dto.js';
import { GetTwoStepVerificationPath } from '../../dto/input/two-step/get-two-step-verification-path.dto.js';
import { RegenerateBackupCodesBody } from '../../dto/input/two-step/regenerate-backup-codes-body.dto.js';
import { RegenerateBackupCodesPath } from '../../dto/input/two-step/regenerate-backup-codes-path.dto.js';
import { RemoveSecurityKeyBody } from '../../dto/input/two-step/remove-security-key-body.dto.js';
import { RemoveSecurityKeyPath } from '../../dto/input/two-step/remove-security-key-path.dto.js';
import { StartAuthenticatorAppSetupBody } from '../../dto/input/two-step/start-authenticator-app-setup-body.dto.js';
import { StartAuthenticatorAppSetupPath } from '../../dto/input/two-step/start-authenticator-app-setup-path.dto.js';
import { StartSecurityKeyRegistrationBody } from '../../dto/input/two-step/start-security-key-registration-body.dto.js';
import { StartSecurityKeyRegistrationPath } from '../../dto/input/two-step/start-security-key-registration-path.dto.js';
import { answerRefusals } from '../../errors/authentication/account-refusal.problem.js';
import {
  toAuthenticatorAppConfigured,
  toAuthenticatorAppSetup,
  toBackupCodes,
  toSecurityKey,
  toSecurityKeyRegistration,
  toTwoStepVerification,
} from '../../mappers/two-step/two-step-verification.mapper.js';

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
 * Class TwoStepVerificationController
 *
 * @description
 * The eight routes of the two-step verification of an account (`openapi/internal/identity-service.yaml`,
 * "Two-step verification", decisions 7 and 8 of P2c; Compte › Sécurité of the mockup). Issuer
 * `api-gateway` only, actor `user`, no organization (one the token may carry is ignored); the
 * account of the path must be the actor, the session of the body an open session of the actor.
 * Bodies are validated with the zod schemas of `@cadenway/contracts`; refusals map in
 * `answerRefusals`. The secret of an app, its codes, the backup codes and the WebAuthn answers are
 * secrets: nothing here logs them.
 */
@Controller('internal/v1/users')
@InternalAccess({ issuers: ['api-gateway'], actors: ['user'], organization: 'optional' })
export class TwoStepVerificationController {
  // #region Properties
  /**
   * Property getTwoStepVerification
   *
   * @description
   * Use case of the reading of the card.
   *
   * @type {GetTwoStepVerification}
   * @readonly
   */
  private readonly getTwoStepVerification: GetTwoStepVerification;

  /**
   * Property disableTwoStepVerification
   *
   * @description
   * Use case of the disabling.
   *
   * @type {DisableTwoStepVerification}
   * @readonly
   */
  private readonly disableTwoStepVerification: DisableTwoStepVerification;

  /**
   * Property startAuthenticatorAppSetup
   *
   * @description
   * Use case of the start of a setup of an app.
   *
   * @type {StartAuthenticatorAppSetup}
   * @readonly
   */
  private readonly startAuthenticatorAppSetup: StartAuthenticatorAppSetup;

  /**
   * Property confirmAuthenticatorAppSetup
   *
   * @description
   * Use case of the confirmation of an app.
   *
   * @type {ConfirmAuthenticatorAppSetup}
   * @readonly
   */
  private readonly confirmAuthenticatorAppSetup: ConfirmAuthenticatorAppSetup;

  /**
   * Property regenerateBackupCodes
   *
   * @description
   * Use case of new backup codes.
   *
   * @type {RegenerateBackupCodes}
   * @readonly
   */
  private readonly regenerateBackupCodes: RegenerateBackupCodes;

  /**
   * Property startSecurityKeyRegistration
   *
   * @description
   * Use case of the start of a registration of a key.
   *
   * @type {StartSecurityKeyRegistration}
   * @readonly
   */
  private readonly startSecurityKeyRegistration: StartSecurityKeyRegistration;

  /**
   * Property addSecurityKey
   *
   * @description
   * Use case of the registration of a key.
   *
   * @type {AddSecurityKey}
   * @readonly
   */
  private readonly addSecurityKey: AddSecurityKey;

  /**
   * Property removeSecurityKey
   *
   * @description
   * Use case of the removal of a key.
   *
   * @type {RemoveSecurityKey}
   * @readonly
   */
  private readonly removeSecurityKey: RemoveSecurityKey;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the use cases of the two-step verification.
   *
   * @param {GetTwoStepVerification} getTwoStepVerification - The reading of the card.
   * @param {DisableTwoStepVerification} disableTwoStepVerification - The disabling.
   * @param {StartAuthenticatorAppSetup} startAuthenticatorAppSetup - The start of a setup.
   * @param {ConfirmAuthenticatorAppSetup} confirmAuthenticatorAppSetup - The confirmation of an app.
   * @param {RegenerateBackupCodes} regenerateBackupCodes - New backup codes.
   * @param {StartSecurityKeyRegistration} startSecurityKeyRegistration - The start of a registration.
   * @param {AddSecurityKey} addSecurityKey - The registration of a key.
   * @param {RemoveSecurityKey} removeSecurityKey - The removal of a key.
   * @constructor
   */
  public constructor(
    getTwoStepVerification: GetTwoStepVerification,
    disableTwoStepVerification: DisableTwoStepVerification,
    startAuthenticatorAppSetup: StartAuthenticatorAppSetup,
    confirmAuthenticatorAppSetup: ConfirmAuthenticatorAppSetup,
    regenerateBackupCodes: RegenerateBackupCodes,
    startSecurityKeyRegistration: StartSecurityKeyRegistration,
    addSecurityKey: AddSecurityKey,
    removeSecurityKey: RemoveSecurityKey,
  ) {
    this.getTwoStepVerification = getTwoStepVerification;
    this.disableTwoStepVerification = disableTwoStepVerification;
    this.startAuthenticatorAppSetup = startAuthenticatorAppSetup;
    this.confirmAuthenticatorAppSetup = confirmAuthenticatorAppSetup;
    this.regenerateBackupCodes = regenerateBackupCodes;
    this.startSecurityKeyRegistration = startSecurityKeyRegistration;
    this.addSecurityKey = addSecurityKey;
    this.removeSecurityKey = removeSecurityKey;
  }
  // #endregion

  // #region Methods
  /**
   * Method read
   *
   * @description
   * `GET .../{userId}/two-step-verification`: `200` with the card; `404 user.not-found` for
   * another account.
   *
   * @param {GetTwoStepVerificationPath} path - The account.
   * @param {Response} response - The response of the refusals.
   * @returns {Promise<TwoStepVerification>} The card, without any secret.
   */
  @Get(':userId/two-step-verification')
  public async read(
    @Param() path: GetTwoStepVerificationPath,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TwoStepVerification> {
    const actor: string = actorUserId();
    return toTwoStepVerification(
      await answerRefusals(response, () =>
        this.getTwoStepVerification.execute({ actorUserId: actor, userId: path.userId }),
      ),
    );
  }

  /**
   * Method disable
   *
   * @description
   * `POST .../{userId}/two-step-verification/disable`: `204`, already off included;
   * `403 auth.reauthentication-required`, `404`, `409 auth.mfa-required-by-organization`.
   *
   * @param {DisableTwoStepVerificationPath} path - The account.
   * @param {DisableTwoStepVerificationBody} body - The session and the browser.
   * @param {Response} response - The response of the refusals.
   * @returns {Promise<void>} No body.
   */
  @Post(':userId/two-step-verification/disable')
  @HttpCode(204)
  public async disable(
    @Param() path: DisableTwoStepVerificationPath,
    @Body() body: DisableTwoStepVerificationBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const actor: string = actorUserId();
    await answerRefusals(response, () =>
      this.disableTwoStepVerification.execute({
        actorUserId: actor,
        userId: path.userId,
        sessionId: body.sessionId,
        client: body.client,
      }),
    );
  }

  /**
   * Method startSetup
   *
   * @description
   * `POST .../{userId}/two-step-verification/authenticator-app/setup`: `200` with a new secret for
   * 15 minutes; `403 auth.reauthentication-required`, `404`.
   *
   * @param {StartAuthenticatorAppSetupPath} path - The account.
   * @param {StartAuthenticatorAppSetupBody} body - The session.
   * @param {Response} response - The response of the refusals.
   * @returns {Promise<AuthenticatorAppSetup>} The secret, its URI and its expiry, returned once.
   */
  @Post(':userId/two-step-verification/authenticator-app/setup')
  @HttpCode(200)
  public async startSetup(
    @Param() path: StartAuthenticatorAppSetupPath,
    @Body() body: StartAuthenticatorAppSetupBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthenticatorAppSetup> {
    const actor: string = actorUserId();
    return toAuthenticatorAppSetup(
      await answerRefusals(response, () =>
        this.startAuthenticatorAppSetup.execute({
          actorUserId: actor,
          userId: path.userId,
          sessionId: body.sessionId,
        }),
      ),
    );
  }

  /**
   * Method confirmSetup
   *
   * @description
   * `POST .../{userId}/two-step-verification/authenticator-app/setup/confirmation`: `200` with the
   * card, and the backup codes when it turned on; `404`, `422 auth.two-step-setup-expired` or
   * `auth.two-step-code-invalid`.
   *
   * @param {ConfirmAuthenticatorAppSetupPath} path - The account.
   * @param {ConfirmAuthenticatorAppSetupBody} body - The session, the code and the browser.
   * @param {Response} response - The response of the refusals.
   * @returns {Promise<AuthenticatorAppConfigured>} The card and the codes.
   */
  @Post(':userId/two-step-verification/authenticator-app/setup/confirmation')
  @HttpCode(200)
  public async confirmSetup(
    @Param() path: ConfirmAuthenticatorAppSetupPath,
    @Body() body: ConfirmAuthenticatorAppSetupBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthenticatorAppConfigured> {
    const actor: string = actorUserId();
    return toAuthenticatorAppConfigured(
      await answerRefusals(response, () =>
        this.confirmAuthenticatorAppSetup.execute({
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
   * Method regenerate
   *
   * @description
   * `POST .../{userId}/two-step-verification/backup-codes/regenerate`: `200` with 10 new codes;
   * `403 auth.reauthentication-required`, `404`, `409 auth.two-step-not-enabled`.
   *
   * @param {RegenerateBackupCodesPath} path - The account.
   * @param {RegenerateBackupCodesBody} body - The session and the browser.
   * @param {Response} response - The response of the refusals.
   * @returns {Promise<BackupCodes>} The new codes, returned once.
   */
  @Post(':userId/two-step-verification/backup-codes/regenerate')
  @HttpCode(200)
  public async regenerate(
    @Param() path: RegenerateBackupCodesPath,
    @Body() body: RegenerateBackupCodesBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<BackupCodes> {
    const actor: string = actorUserId();
    return toBackupCodes(
      await answerRefusals(response, () =>
        this.regenerateBackupCodes.execute({
          actorUserId: actor,
          userId: path.userId,
          sessionId: body.sessionId,
          client: body.client,
        }),
      ),
    );
  }

  /**
   * Method startRegistration
   *
   * @description
   * `POST .../{userId}/two-step-verification/security-keys/registration`: `200` with WebAuthn
   * creation options for 5 minutes; `403 auth.reauthentication-required`, `404`,
   * `409 auth.two-step-not-enabled` or `auth.security-key-limit-reached`.
   *
   * @param {StartSecurityKeyRegistrationPath} path - The account.
   * @param {StartSecurityKeyRegistrationBody} body - The session.
   * @param {Response} response - The response of the refusals.
   * @returns {Promise<SecurityKeyRegistration>} The options and their expiry.
   */
  @Post(':userId/two-step-verification/security-keys/registration')
  @HttpCode(200)
  public async startRegistration(
    @Param() path: StartSecurityKeyRegistrationPath,
    @Body() body: StartSecurityKeyRegistrationBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SecurityKeyRegistration> {
    const actor: string = actorUserId();
    return toSecurityKeyRegistration(
      await answerRefusals(response, () =>
        this.startSecurityKeyRegistration.execute({
          actorUserId: actor,
          userId: path.userId,
          sessionId: body.sessionId,
        }),
      ),
    );
  }

  /**
   * Method add
   *
   * @description
   * `POST .../{userId}/two-step-verification/security-keys`: `201` with the key and its
   * `Location`; `404`, `409 auth.two-step-not-enabled` or `auth.security-key-limit-reached`,
   * `422 auth.two-step-setup-expired` or `auth.security-key-refused`.
   *
   * @param {AddSecurityKeyPath} path - The account.
   * @param {AddSecurityKeyBody} body - The session, the name, the answer and the browser.
   * @param {Response} response - The response, for `Location` and the refusals.
   * @returns {Promise<SecurityKey>} The new key.
   */
  @Post(':userId/two-step-verification/security-keys')
  @HttpCode(201)
  public async add(
    @Param() path: AddSecurityKeyPath,
    @Body() body: AddSecurityKeyBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SecurityKey> {
    const actor: string = actorUserId();
    const key: SecurityKeyView = await answerRefusals(response, () =>
      this.addSecurityKey.execute({
        actorUserId: actor,
        userId: path.userId,
        sessionId: body.sessionId,
        name: body.name,
        credential: body.credential,
        client: body.client,
      }),
    );
    response.setHeader(
      'Location',
      `/internal/v1/users/${path.userId}/two-step-verification/security-keys/${key.id}`,
    );
    return toSecurityKey(key);
  }

  /**
   * Method remove
   *
   * @description
   * `POST .../{userId}/two-step-verification/security-keys/{securityKeyId}/remove`: `204`;
   * `403 auth.reauthentication-required`, `404 user.not-found`, `session.not-found` or
   * `security-key.not-found`.
   *
   * @param {RemoveSecurityKeyPath} path - The account and the key.
   * @param {RemoveSecurityKeyBody} body - The session and the browser.
   * @param {Response} response - The response of the refusals.
   * @returns {Promise<void>} No body.
   */
  @Post(':userId/two-step-verification/security-keys/:securityKeyId/remove')
  @HttpCode(204)
  public async remove(
    @Param() path: RemoveSecurityKeyPath,
    @Body() body: RemoveSecurityKeyBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const actor: string = actorUserId();
    await answerRefusals(response, () =>
      this.removeSecurityKey.execute({
        actorUserId: actor,
        userId: path.userId,
        sessionId: body.sessionId,
        securityKeyId: path.securityKeyId,
        client: body.client,
      }),
    );
  }
  // #endregion
}
