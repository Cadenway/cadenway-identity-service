import type {
  FederatedFlowStarted,
  FederatedReceipt,
  SessionIssued,
  SignInChallenge,
} from '@cadenway/contracts/types/internal/identity-service';
import {
  CompleteSamlSignInInternalBody,
  FinishFederatedSignInInternalBody,
  StartFederatedSignInInternalBody,
} from '@cadenway/contracts/validators/internal/identity-service';
import {
  getOrganizationContext,
  InternalAccess,
  ProblemException,
  ZodValidationPipe,
} from '@cadenway/nest-common';
import { Body, Controller, Header, HttpCode, Inject, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { z } from 'zod';

import { FederatedFinishRefusal } from '../../../../application/models/authentication/federated-finish-refusal.model.js';
import { CompleteSamlSignIn } from '../../../../application/use-cases/commands/federated-sign-in/complete-saml-sign-in/complete-saml-sign-in.use-case.js';
import { CompleteSocialSignIn } from '../../../../application/use-cases/commands/federated-sign-in/complete-social-sign-in/complete-social-sign-in.use-case.js';
import { FinishFederatedSignIn } from '../../../../application/use-cases/commands/federated-sign-in/finish-federated-sign-in/finish-federated-sign-in.use-case.js';
import { StartSamlSignIn } from '../../../../application/use-cases/commands/federated-sign-in/start-saml-sign-in/start-saml-sign-in.use-case.js';
import { StartSocialSignIn } from '../../../../application/use-cases/commands/federated-sign-in/start-social-sign-in/start-social-sign-in.use-case.js';
import { FederatedOauthCallbackDto } from '../../dto/input/authentication/federated-oauth-callback.dto.js';
import { answerRefusals } from '../../errors/authentication/account-refusal.problem.js';
import { toSessionIssued } from '../../mappers/authentication/session-issued.mapper.js';
import { toSignInChallenge } from '../../mappers/two-step/sign-in-challenge.mapper.js';

function requireOrganizationFreeCaller(): void {
  const context = getOrganizationContext();
  if (context !== undefined && context.organizationId !== null) {
    throw new ProblemException({ status: 403, code: 'auth.actor-not-allowed' });
  }
}

function federationProblem(error: unknown): never {
  let cause = error;
  for (let depth = 0; depth < 4 && typeof cause === 'object' && cause !== null; depth++) {
    if (
      'code' in cause &&
      typeof cause.code === 'string' &&
      /^(?:08[A-Z0-9]{3}|40001|40P01|53300|55P03|57014|57P0[123]|ECONNREFUSED|ECONNRESET|ETIMEDOUT)$/u.test(
        cause.code,
      )
    ) {
      throw new ProblemException({ status: 503, code: 'auth.federated-unavailable' });
    }
    cause = 'cause' in cause ? cause.cause : undefined;
  }
  throw error;
}

/** Routes for the browser-bound federated sign-in flows. */
@Controller('internal/v1/auth/sign-in/federated')
@InternalAccess({ issuers: ['api-gateway'], actors: ['anonymous'], organization: 'optional' })
export class FederatedSignInController {
  // #region Constructor
  /** Binds the configured social and SAML use cases and ordinary session admission. */
  public constructor(
    @Inject(StartSocialSignIn) private readonly startSocial: StartSocialSignIn | null,
    @Inject(StartSamlSignIn) private readonly startSaml: StartSamlSignIn | null,
    @Inject(CompleteSocialSignIn) private readonly completeSocial: CompleteSocialSignIn | null,
    @Inject(CompleteSamlSignIn) private readonly completeSaml: CompleteSamlSignIn | null,
    private readonly finishSignIn: FinishFederatedSignIn,
  ) {}
  // #endregion

  // #region Methods
  /** Starts a social or organization-selected SAML flow. */
  @Post('start')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  public async start(
    @Body(new ZodValidationPipe(StartFederatedSignInInternalBody))
    body: z.output<typeof StartFederatedSignInInternalBody>,
  ): Promise<FederatedFlowStarted> {
    requireOrganizationFreeCaller();
    let result;
    if (body.provider === 'saml') {
      if (this.startSaml === null) return this.refuse('unavailable');
      result = await this.startSaml
        .execute({ email: body.email, rememberMe: body.rememberMe })
        .catch(federationProblem);
    } else {
      if (this.startSocial === null) return this.refuse('unavailable');
      result = await this.startSocial
        .execute({ provider: body.provider, rememberMe: body.rememberMe })
        .catch(federationProblem);
    }
    if (result.kind !== 'started') return this.refuse(result.kind);
    return {
      authorizationUrl: result.authorizationUrl,
      browserBinding: result.browserBinding,
      expiresAt: result.expiresAt.toISOString(),
    };
  }

  /** Claims and verifies a social provider response. */
  @Post('oauth/callback')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  public async oauthCallback(@Body() body: FederatedOauthCallbackDto): Promise<FederatedReceipt> {
    requireOrganizationFreeCaller();
    if (this.completeSocial === null) return this.refuse('unavailable');
    const result = await this.completeSocial.execute(body).catch(federationProblem);
    if (result.kind !== 'issued') return this.refuse(result.kind);
    return { receipt: result.receipt, expiresAt: result.expiresAt.toISOString() };
  }

  /** Claims and verifies an SP-initiated SAML response. */
  @Post('saml/callback')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  public async samlCallback(
    @Body(new ZodValidationPipe(CompleteSamlSignInInternalBody))
    body: z.output<typeof CompleteSamlSignInInternalBody>,
  ): Promise<FederatedReceipt> {
    requireOrganizationFreeCaller();
    if (this.completeSaml === null) return this.refuse('unavailable');
    const result = await this.completeSaml.execute(body).catch(federationProblem);
    if (result.kind !== 'issued') return this.refuse(result.kind);
    return { receipt: result.receipt, expiresAt: result.expiresAt.toISOString() };
  }

  /** Redeems a receipt through the usual session and two-step policy. */
  @Post('finish')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  public async finish(
    @Body(new ZodValidationPipe(FinishFederatedSignInInternalBody))
    body: z.output<typeof FinishFederatedSignInInternalBody>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionIssued | SignInChallenge> {
    requireOrganizationFreeCaller();
    try {
      const result = await answerRefusals(response, () => this.finishSignIn.execute(body));
      if (result.kind === 'challenge') {
        response.status(202);
        return toSignInChallenge(result.challenge);
      }
      return toSessionIssued(result.issued);
    } catch (error) {
      if (error instanceof FederatedFinishRefusal) return this.refuse('refused');
      return federationProblem(error);
    }
  }

  private refuse(reason: 'refused' | 'unavailable'): never {
    throw new ProblemException(
      reason === 'refused'
        ? { status: 422, code: 'auth.federated-sign-in-refused' }
        : { status: 503, code: 'auth.federated-unavailable' },
    );
  }
  // #endregion
}
