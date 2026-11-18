import type {
  SecurityKeyAssertionOptions,
  SessionIssued,
  SignInChallenge,
} from '@cadenway/contracts/types/internal/identity-service';
import { InternalAccess } from '@cadenway/nest-common';
import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';

import { AnswerChallengeWithAuthenticatorApp } from '../../../../application/use-cases/commands/authentication/answer-challenge-with-authenticator-app/answer-challenge-with-authenticator-app.use-case.js';
import { AnswerChallengeWithBackupCode } from '../../../../application/use-cases/commands/authentication/answer-challenge-with-backup-code/answer-challenge-with-backup-code.use-case.js';
import { AnswerChallengeWithSecurityKey } from '../../../../application/use-cases/commands/authentication/answer-challenge-with-security-key/answer-challenge-with-security-key.use-case.js';
import { IssueChallengeSecurityKeyOptions } from '../../../../application/use-cases/commands/authentication/issue-challenge-security-key-options/issue-challenge-security-key-options.use-case.js';
import { InspectSignInChallenge } from '../../../../application/use-cases/queries/authentication/inspect-sign-in-challenge/inspect-sign-in-challenge.use-case.js';
import { AnswerChallengeWithAuthenticatorAppBody } from '../../dto/input/authentication/answer-challenge-with-authenticator-app-body.dto.js';
import { AnswerChallengeWithBackupCodeBody } from '../../dto/input/authentication/answer-challenge-with-backup-code-body.dto.js';
import { AnswerChallengeWithSecurityKeyBody } from '../../dto/input/authentication/answer-challenge-with-security-key-body.dto.js';
import { InspectSignInChallengeBody } from '../../dto/input/authentication/inspect-sign-in-challenge-body.dto.js';
import { SecurityKeyOptionsBody } from '../../dto/input/authentication/security-key-options-body.dto.js';
import { answerRefusals } from '../../errors/authentication/account-refusal.problem.js';
import { toSessionIssued } from '../../mappers/authentication/session-issued.mapper.js';
import {
  toSecurityKeyAssertionOptions,
  toSignInChallenge,
} from '../../mappers/two-step/sign-in-challenge.mapper.js';

/**
 * Class SignInChallengeController
 *
 * @description
 * The five routes of the two-step challenge of `openapi/internal/identity-service.yaml` ("Two-step
 * challenge", decision 7 of P2c), which run between the `202` of a sign-in and its session. Every
 * route accepts the internal token of the issuer `api-gateway` only, with the actor `anonymous`
 * and no organization (one the token may carry is ignored). Bodies are validated with the zod
 * schemas of `@cadenway/contracts` (`400 request.invalid`, never echoing a value); refusals map in
 * `answerRefusals`. The token of the challenge, the codes, the WebAuthn answers and the token of a
 * trusted device are secrets: nothing here logs them.
 */
@Controller('internal/v1/auth/sign-in/challenge')
@InternalAccess({ issuers: ['api-gateway'], actors: ['anonymous'], organization: 'optional' })
export class SignInChallengeController {
  // #region Properties
  /**
   * Property inspectSignInChallenge
   *
   * @description
   * Use case of the inspection of a challenge.
   *
   * @type {InspectSignInChallenge}
   * @readonly
   */
  private readonly inspectSignInChallenge: InspectSignInChallenge;

  /**
   * Property answerWithAuthenticatorApp
   *
   * @description
   * Use case of the answer with a code of the app.
   *
   * @type {AnswerChallengeWithAuthenticatorApp}
   * @readonly
   */
  private readonly answerWithAuthenticatorApp: AnswerChallengeWithAuthenticatorApp;

  /**
   * Property answerWithBackupCode
   *
   * @description
   * Use case of the answer with a backup code.
   *
   * @type {AnswerChallengeWithBackupCode}
   * @readonly
   */
  private readonly answerWithBackupCode: AnswerChallengeWithBackupCode;

  /**
   * Property issueSecurityKeyOptions
   *
   * @description
   * Use case of the WebAuthn options of a challenge.
   *
   * @type {IssueChallengeSecurityKeyOptions}
   * @readonly
   */
  private readonly issueSecurityKeyOptions: IssueChallengeSecurityKeyOptions;

  /**
   * Property answerWithSecurityKey
   *
   * @description
   * Use case of the answer with a security key.
   *
   * @type {AnswerChallengeWithSecurityKey}
   * @readonly
   */
  private readonly answerWithSecurityKey: AnswerChallengeWithSecurityKey;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the use cases of the challenge.
   *
   * @param {InspectSignInChallenge} inspectSignInChallenge - The inspection.
   * @param {AnswerChallengeWithAuthenticatorApp} answerWithAuthenticatorApp - The answer by app.
   * @param {AnswerChallengeWithBackupCode} answerWithBackupCode - The answer by backup code.
   * @param {IssueChallengeSecurityKeyOptions} issueSecurityKeyOptions - The WebAuthn options.
   * @param {AnswerChallengeWithSecurityKey} answerWithSecurityKey - The answer by key.
   * @constructor
   */
  public constructor(
    inspectSignInChallenge: InspectSignInChallenge,
    answerWithAuthenticatorApp: AnswerChallengeWithAuthenticatorApp,
    answerWithBackupCode: AnswerChallengeWithBackupCode,
    issueSecurityKeyOptions: IssueChallengeSecurityKeyOptions,
    answerWithSecurityKey: AnswerChallengeWithSecurityKey,
  ) {
    this.inspectSignInChallenge = inspectSignInChallenge;
    this.answerWithAuthenticatorApp = answerWithAuthenticatorApp;
    this.answerWithBackupCode = answerWithBackupCode;
    this.issueSecurityKeyOptions = issueSecurityKeyOptions;
    this.answerWithSecurityKey = answerWithSecurityKey;
  }
  // #endregion

  // #region Methods
  /**
   * Method inspect
   *
   * @description
   * `POST /internal/v1/auth/sign-in/challenge/inspection`: `200` with the challenge, as the `202`
   * of the sign-in gave it; `422 auth.challenge-expired` for one no longer usable. Counts nothing.
   *
   * @param {InspectSignInChallengeBody} body - The token of the challenge.
   * @param {Response} response - The response of the refusals.
   * @returns {Promise<SignInChallenge>} The challenge.
   */
  @Post('inspection')
  @HttpCode(200)
  public async inspect(
    @Body() body: InspectSignInChallengeBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SignInChallenge> {
    return toSignInChallenge(
      await answerRefusals(response, () =>
        this.inspectSignInChallenge.execute({ token: body.token }),
      ),
    );
  }

  /**
   * Method authenticatorApp
   *
   * @description
   * `POST /internal/v1/auth/sign-in/challenge/authenticator-app`: `200` with the session;
   * `422 auth.challenge-expired` or `auth.two-step-code-invalid`, `429 auth.two-step-locked` with
   * `Retry-After`.
   *
   * @param {AnswerChallengeWithAuthenticatorAppBody} body - The token, the code, `trustDevice` and
   * the browser.
   * @param {Response} response - The response, for `Retry-After`.
   * @returns {Promise<SessionIssued>} The session, and the trusted device when asked.
   */
  @Post('authenticator-app')
  @HttpCode(200)
  public async authenticatorApp(
    @Body() body: AnswerChallengeWithAuthenticatorAppBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionIssued> {
    return toSessionIssued(
      await answerRefusals(response, () =>
        this.answerWithAuthenticatorApp.execute({
          token: body.token,
          code: body.code,
          trustDevice: body.trustDevice,
          client: body.client,
        }),
      ),
    );
  }

  /**
   * Method backupCode
   *
   * @description
   * `POST /internal/v1/auth/sign-in/challenge/backup-code`: `200` with the session, the code used
   * up; the refusals of the answer by app, counted together.
   *
   * @param {AnswerChallengeWithBackupCodeBody} body - The token, the code, `trustDevice` and the
   * browser.
   * @param {Response} response - The response, for `Retry-After`.
   * @returns {Promise<SessionIssued>} The session, and the trusted device when asked.
   */
  @Post('backup-code')
  @HttpCode(200)
  public async backupCode(
    @Body() body: AnswerChallengeWithBackupCodeBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionIssued> {
    return toSessionIssued(
      await answerRefusals(response, () =>
        this.answerWithBackupCode.execute({
          token: body.token,
          code: body.code,
          trustDevice: body.trustDevice,
          client: body.client,
        }),
      ),
    );
  }

  /**
   * Method securityKeyOptions
   *
   * @description
   * `POST /internal/v1/auth/sign-in/challenge/security-key/options`: `200` with new WebAuthn
   * options for 5 minutes; `422 auth.challenge-expired` or `auth.security-key-refused` for an
   * account without a key, `429 auth.two-step-locked`. Counts nothing.
   *
   * @param {SecurityKeyOptionsBody} body - The token of the challenge.
   * @param {Response} response - The response, for `Retry-After`.
   * @returns {Promise<SecurityKeyAssertionOptions>} The options and their expiry.
   */
  @Post('security-key/options')
  @HttpCode(200)
  public async securityKeyOptions(
    @Body() body: SecurityKeyOptionsBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SecurityKeyAssertionOptions> {
    return toSecurityKeyAssertionOptions(
      await answerRefusals(response, () =>
        this.issueSecurityKeyOptions.execute({ token: body.token }),
      ),
    );
  }

  /**
   * Method securityKey
   *
   * @description
   * `POST /internal/v1/auth/sign-in/challenge/security-key`: `200` with the session;
   * `422 auth.challenge-expired` or `auth.security-key-refused`, `429 auth.two-step-locked`.
   *
   * @param {AnswerChallengeWithSecurityKeyBody} body - The token, the answer of the browser,
   * `trustDevice` and the browser.
   * @param {Response} response - The response, for `Retry-After`.
   * @returns {Promise<SessionIssued>} The session, and the trusted device when asked.
   */
  @Post('security-key')
  @HttpCode(200)
  public async securityKey(
    @Body() body: AnswerChallengeWithSecurityKeyBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionIssued> {
    return toSessionIssued(
      await answerRefusals(response, () =>
        this.answerWithSecurityKey.execute({
          token: body.token,
          credential: body.credential,
          trustDevice: body.trustDevice,
          client: body.client,
        }),
      ),
    );
  }
  // #endregion
}
