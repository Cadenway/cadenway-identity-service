import type {
  CodeSent,
  SessionIssued,
  SignInMethods,
} from '@cadenway/contracts/types/internal/identity-service';
import {
  DiscoverSignInMethodsInternalBody,
  RequestSignInCodeInternalBody,
  ResendSignUpCodeInternalBody,
  SignInWithCodeInternalBody,
  SignInWithPasswordInternalBody,
  SignUpInternalBody,
  VerifySignUpInternalBody,
} from '@cadenway/contracts/validators/internal/identity-service';
import { InternalAccess, zodDto } from '@cadenway/nest-common';
import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';

import type { CodeSentView, SessionIssuedView } from '../../application/account-views.js';
import { RequestSignInCode } from '../../application/commands/request-sign-in-code.js';
import { ResendSignUpCode } from '../../application/commands/resend-sign-up-code.js';
import { SignInWithCode } from '../../application/commands/sign-in-with-code.js';
import { SignInWithPassword } from '../../application/commands/sign-in-with-password.js';
import { SignUp } from '../../application/commands/sign-up.js';
import { VerifySignUp } from '../../application/commands/verify-sign-up.js';
import { DiscoverSignInMethods } from '../../application/queries/discover-sign-in-methods.js';
import { answerRefusals } from './account-problems.js';

/**
 * Class SignInMethodsBody
 *
 * @description
 * Body of `POST /internal/v1/auth/sign-in-methods`, validated with the schema of the contract.
 */
class SignInMethodsBody extends zodDto(DiscoverSignInMethodsInternalBody) {}

/**
 * Class SignUpBody
 *
 * @description
 * Body of `POST /internal/v1/auth/sign-up`, validated with the schema of the contract. The name is
 * also refused when it holds nothing but spaces, since its surrounding spaces are removed
 * (`SignUpRequest.name` of `openapi/public/auth.yaml`): `400 request.invalid` on `name`.
 */
class SignUpBody extends zodDto(
  SignUpInternalBody.refine((body: { readonly name: string }): boolean => body.name.trim() !== '', {
    path: ['name'],
    error: 'Expected a name with a character other than a space',
  }),
) {}

/**
 * Class ResendSignUpCodeBody
 *
 * @description
 * Body of `POST /internal/v1/auth/sign-up/code`, validated with the schema of the contract.
 */
class ResendSignUpCodeBody extends zodDto(ResendSignUpCodeInternalBody) {}

/**
 * Class VerifySignUpBody
 *
 * @description
 * Body of `POST /internal/v1/auth/sign-up/verification`, validated with the schema of the contract.
 */
class VerifySignUpBody extends zodDto(VerifySignUpInternalBody) {}

/**
 * Class PasswordSignInBody
 *
 * @description
 * Body of `POST /internal/v1/auth/sign-in`, validated with the schema of the contract.
 */
class PasswordSignInBody extends zodDto(SignInWithPasswordInternalBody) {}

/**
 * Class SignInCodeBody
 *
 * @description
 * Body of `POST /internal/v1/auth/sign-in/code`, validated with the schema of the contract.
 */
class SignInCodeBody extends zodDto(RequestSignInCodeInternalBody) {}

/**
 * Class SignInWithCodeBody
 *
 * @description
 * Body of `POST /internal/v1/auth/sign-in/code/verification`, validated with the schema of the
 * contract.
 */
class SignInWithCodeBody extends zodDto(SignInWithCodeInternalBody) {}

/**
 * Function toCodeSent
 *
 * @description
 * Maps the answer of a code request to `CodeSent`.
 *
 * @param {CodeSentView} view - The answer of the use case.
 * @returns {CodeSent} The body of the response.
 */
function toCodeSent(view: CodeSentView): CodeSent {
  return {
    email: view.email,
    expiresAt: view.expiresAt.toISOString(),
    resendAvailableAt: view.resendAvailableAt.toISOString(),
  };
}

/**
 * Function toSessionIssued
 *
 * @description
 * Maps a successful sign-in to `SessionIssued`. `token` leaves this service here only: the gateway
 * writes it into the cookie and never logs it.
 *
 * @param {SessionIssuedView} view - The answer of the use case.
 * @returns {SessionIssued} The body of the response.
 */
function toSessionIssued(view: SessionIssuedView): SessionIssued {
  return {
    token: view.session.token,
    session: {
      id: view.session.id,
      expiresAt: view.session.expiresAt.toISOString(),
      persistent: view.session.persistent,
    },
    user: {
      id: view.user.id,
      name: view.user.name,
      email: view.user.email,
      language: view.user.language,
      version: view.user.version,
    },
  };
}

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
   * `POST /internal/v1/auth/sign-up/code`: `202` for any address; `429` within 30 seconds.
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
   * code.
   *
   * @param {VerifySignUpBody} body - The code and the browser.
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
   * `POST /internal/v1/auth/sign-in/code`: `202` for any address; `429` within 30 seconds.
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
