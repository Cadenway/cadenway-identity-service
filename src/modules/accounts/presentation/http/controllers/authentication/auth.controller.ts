import type {
  CodeSent,
  SessionIssued,
  SignInMethods,
} from '@cadenway/contracts/types/internal/identity-service';
import { InternalAccess } from '@cadenway/nest-common';
import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';

import { RequestSignInCode } from '../../../../application/use-cases/commands/authentication/request-sign-in-code/request-sign-in-code.use-case.js';
import { ResendSignUpCode } from '../../../../application/use-cases/commands/authentication/resend-sign-up-code/resend-sign-up-code.use-case.js';
import { SignInWithCode } from '../../../../application/use-cases/commands/authentication/sign-in-with-code/sign-in-with-code.use-case.js';
import { SignInWithPassword } from '../../../../application/use-cases/commands/authentication/sign-in-with-password/sign-in-with-password.use-case.js';
import { SignUp } from '../../../../application/use-cases/commands/authentication/sign-up/sign-up.use-case.js';
import { VerifySignUp } from '../../../../application/use-cases/commands/authentication/verify-sign-up/verify-sign-up.use-case.js';
import { DiscoverSignInMethods } from '../../../../application/use-cases/queries/authentication/discover-sign-in-methods/discover-sign-in-methods.use-case.js';
import { PasswordSignInBody } from '../../dto/input/authentication/password-sign-in-body.dto.js';
import { ResendSignUpCodeBody } from '../../dto/input/authentication/resend-sign-up-code-body.dto.js';
import { SignInCodeBody } from '../../dto/input/authentication/sign-in-code-body.dto.js';
import { SignInMethodsBody } from '../../dto/input/authentication/sign-in-methods-body.dto.js';
import { SignInWithCodeBody } from '../../dto/input/authentication/sign-in-with-code-body.dto.js';
import { SignUpBody } from '../../dto/input/authentication/sign-up-body.dto.js';
import { VerifySignUpBody } from '../../dto/input/authentication/verify-sign-up-body.dto.js';
import { answerRefusals } from '../../errors/authentication/account-refusal.problem.js';
import { toCodeSent } from '../../mappers/authentication/code-sent.mapper.js';
import { toSessionIssued } from '../../mappers/authentication/session-issued.mapper.js';

/**
 * Class AuthController
 *
 * @description
 * The seven authentication flows of `openapi/internal/identity-service.yaml`, which run before a
 * session exists. Every route accepts the internal token of the issuer `api-gateway` only, with the
 * actor `anonymous` and no organization; the guard of `@cadenway/nest-common` answers
 * `401 auth.token-missing`, `401 auth.token-invalid`, `403 auth.issuer-not-allowed` and
 * `403 auth.actor-not-allowed`. Bodies are validated with the zod schemas of `@cadenway/contracts`
 * (`400 request.invalid`, never echoing a value), and refusals map to the codes of the contract in
 * `answerRefusals`. Nothing here logs a password, a code or a token.
 */
@Controller('internal/v1/auth')
@InternalAccess({ issuers: ['api-gateway'], actors: ['anonymous'], organization: 'optional' })
export class AuthController {
  // #region Properties
  /**
   * Property discoverSignInMethods
   *
   * @description
   * Use case of the method discovery.
   *
   * @type {DiscoverSignInMethods}
   * @readonly
   */
  private readonly discoverSignInMethods: DiscoverSignInMethods;

  /**
   * Property signUpUseCase
   *
   * @description
   * Use case of the sign-up.
   *
   * @type {SignUp}
   * @readonly
   */
  private readonly signUpUseCase: SignUp;

  /**
   * Property resendSignUpCode
   *
   * @description
   * Use case of a new sign-up code.
   *
   * @type {ResendSignUpCode}
   * @readonly
   */
  private readonly resendSignUpCode: ResendSignUpCode;

  /**
   * Property verifySignUp
   *
   * @description
   * Use case of the address verification.
   *
   * @type {VerifySignUp}
   * @readonly
   */
  private readonly verifySignUp: VerifySignUp;

  /**
   * Property signInWithPassword
   *
   * @description
   * Use case of the password sign-in.
   *
   * @type {SignInWithPassword}
   * @readonly
   */
  private readonly signInWithPassword: SignInWithPassword;

  /**
   * Property requestSignInCode
   *
   * @description
   * Use case of a sign-in code request.
   *
   * @type {RequestSignInCode}
   * @readonly
   */
  private readonly requestSignInCode: RequestSignInCode;

  /**
   * Property signInWithCode
   *
   * @description
   * Use case of the code sign-in.
   *
   * @type {SignInWithCode}
   * @readonly
   */
  private readonly signInWithCode: SignInWithCode;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the use cases, provided by `AccountsModule`.
   *
   * @param {DiscoverSignInMethods} discoverSignInMethods - Use case of the method discovery.
   * @param {SignUp} signUpUseCase - Use case of the sign-up.
   * @param {ResendSignUpCode} resendSignUpCode - Use case of a new sign-up code.
   * @param {VerifySignUp} verifySignUp - Use case of the address verification.
   * @param {SignInWithPassword} signInWithPassword - Use case of the password sign-in.
   * @param {RequestSignInCode} requestSignInCode - Use case of a sign-in code request.
   * @param {SignInWithCode} signInWithCode - Use case of the code sign-in.
   * @constructor
   */
  public constructor(
    discoverSignInMethods: DiscoverSignInMethods,
    signUpUseCase: SignUp,
    resendSignUpCode: ResendSignUpCode,
    verifySignUp: VerifySignUp,
    signInWithPassword: SignInWithPassword,
    requestSignInCode: RequestSignInCode,
    signInWithCode: SignInWithCode,
  ) {
    this.discoverSignInMethods = discoverSignInMethods;
    this.signUpUseCase = signUpUseCase;
    this.resendSignUpCode = resendSignUpCode;
    this.verifySignUp = verifySignUp;
    this.signInWithPassword = signInWithPassword;
    this.requestSignInCode = requestSignInCode;
    this.signInWithCode = signInWithCode;
  }
  // #endregion

  // #region Methods
  /**
   * Method discoverMethods
   *
   * @description
   * `POST /internal/v1/auth/sign-in-methods`: `200` with the methods of the address.
   *
   * @param {SignInMethodsBody} body - The address.
   * @returns {SignInMethods} The methods.
   */
  @Post('sign-in-methods')
  @HttpCode(200)
  public discoverMethods(@Body() body: SignInMethodsBody): SignInMethods {
    const view: { readonly methods: readonly { readonly type: string }[] } =
      this.discoverSignInMethods.execute(body);
    return { methods: view.methods.map(({ type }: { readonly type: string }) => ({ type })) };
  }

  /**
   * Method signUp
   *
   * @description
   * `POST /internal/v1/auth/sign-up`: `202` once the account exists and a code was issued; `409`,
   * `422` or `429` otherwise.
   *
   * @param {SignUpBody} body - The sign-up.
   * @param {Response} response - The response, for `Retry-After`.
   * @returns {Promise<CodeSent>} When the code expires and when another can be asked for.
   */
  @Post('sign-up')
  @HttpCode(202)
  public async signUp(
    @Body() body: SignUpBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CodeSent> {
    return toCodeSent(await answerRefusals(response, () => this.signUpUseCase.execute(body)));
  }

  /**
   * Method resendCode
   *
   * @description
   * `POST /internal/v1/auth/sign-up/code`: `202` for any address; `429` less than 30 seconds after
   * the last accepted code request of the address, or once 5 were accepted in the hour.
   *
   * @param {ResendSignUpCodeBody} body - The address.
   * @param {Response} response - The response, for `Retry-After`.
   * @returns {Promise<CodeSent>} The same answer whether or not a code was issued.
   */
  @Post('sign-up/code')
  @HttpCode(202)
  public async resendCode(
    @Body() body: ResendSignUpCodeBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CodeSent> {
    return toCodeSent(await answerRefusals(response, () => this.resendSignUpCode.execute(body)));
  }

  /**
   * Method verify
   *
   * @description
   * `POST /internal/v1/auth/sign-up/verification`: `200` with the session; `422` for a refused
   * code, or `auth.sign-up-replaced` when the right code does not prove the latest sign-up.
   *
   * @param {VerifySignUpBody} body - The code, the password of the sign-up when sent, and the
   * browser.
   * @param {Response} response - The response of the refusals.
   * @returns {Promise<SessionIssued>} The session, its token and the account.
   */
  @Post('sign-up/verification')
  @HttpCode(200)
  public async verify(
    @Body() body: VerifySignUpBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionIssued> {
    return toSessionIssued(await answerRefusals(response, () => this.verifySignUp.execute(body)));
  }

  /**
   * Method signIn
   *
   * @description
   * `POST /internal/v1/auth/sign-in`: `200` with the session; `403`, `422` or `429` otherwise.
   *
   * @param {PasswordSignInBody} body - The address, the password and the browser.
   * @param {Response} response - The response, for `Retry-After`.
   * @returns {Promise<SessionIssued>} The session, its token and the account.
   */
  @Post('sign-in')
  @HttpCode(200)
  public async signIn(
    @Body() body: PasswordSignInBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionIssued> {
    return toSessionIssued(
      await answerRefusals(response, () => this.signInWithPassword.execute(body)),
    );
  }

  /**
   * Method requestCode
   *
   * @description
   * `POST /internal/v1/auth/sign-in/code`: `202` for any address; `429` less than 30 seconds after
   * the last accepted code request of the address, or once 5 were accepted in the hour.
   *
   * @param {SignInCodeBody} body - The address.
   * @param {Response} response - The response, for `Retry-After`.
   * @returns {Promise<CodeSent>} The same answer whether or not a code was issued.
   */
  @Post('sign-in/code')
  @HttpCode(202)
  public async requestCode(
    @Body() body: SignInCodeBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CodeSent> {
    return toCodeSent(await answerRefusals(response, () => this.requestSignInCode.execute(body)));
  }

  /**
   * Method signInCode
   *
   * @description
   * `POST /internal/v1/auth/sign-in/code/verification`: `200` with the session; `422` for a refused
   * code.
   *
   * @param {SignInWithCodeBody} body - The code and the browser.
   * @param {Response} response - The response of the refusals.
   * @returns {Promise<SessionIssued>} The session, its token and the account.
   */
  @Post('sign-in/code/verification')
  @HttpCode(200)
  public async signInCode(
    @Body() body: SignInWithCodeBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionIssued> {
    return toSessionIssued(await answerRefusals(response, () => this.signInWithCode.execute(body)));
  }
  // #endregion
}
