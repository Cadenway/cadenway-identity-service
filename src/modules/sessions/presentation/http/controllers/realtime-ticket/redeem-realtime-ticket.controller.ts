import type { RealtimeSession } from '@cadenway/contracts/types/internal/identity-service';
import { InternalAccess, ProblemException, getOrganizationContext } from '@cadenway/nest-common';
import { Body, Controller, Header, Headers, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';

import { RealtimeTicketNotFound } from '../../../../application/models/realtime-ticket/realtime-ticket-not-found.model.js';
import { RedeemRealtimeTicket } from '../../../../application/use-cases/commands/realtime-ticket/redeem-realtime-ticket/redeem-realtime-ticket.use-case.js';
import { RedeemRealtimeTicketBody } from '../../dto/input/realtime-ticket/redeem-realtime-ticket-body.dto.js';

const samlSourcePreference = 'cadenway-saml-source-membership';

/** Redeems one ticket for the trusted realtime gateway, outside an organization context. */
@Controller('internal/v1/realtime/tickets/redemption')
@InternalAccess({ issuers: ['realtime-gateway'], actors: ['system'], organization: 'optional' })
export class RedeemRealtimeTicketController {
  // #region Constructor
  /** Binds the transactional ticket redeemer. */
  public constructor(private readonly redeem: RedeemRealtimeTicket) {}
  // #endregion

  // #region Methods
  /** Returns the session identity after its ticket was consumed. */
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  public async execute(
    @Body() body: RedeemRealtimeTicketBody,
    @Headers('prefer') prefer?: string,
    @Res({ passthrough: true }) response?: Response,
  ): Promise<RealtimeSession> {
    const context = getOrganizationContext();
    if (context?.organizationId !== null && context?.organizationId !== undefined) {
      throw new ProblemException({ status: 403, code: 'auth.organization-not-allowed' });
    }
    try {
      const includeSamlSource =
        prefer?.split(',').some((item) => item.trim().toLowerCase() === samlSourcePreference) ??
        false;
      const result = await this.redeem.execute({
        token: body.token,
        verifiesSamlSource: includeSamlSource,
      });
      if (includeSamlSource) response?.setHeader('Preference-Applied', samlSourcePreference);
      return {
        sessionId: result.sessionId,
        sessionVersion: result.sessionVersion,
        userId: result.userId,
        organizationId: result.organizationId,
        memberId: result.memberId,
        role: result.role,
        sessionExpiresAt: result.sessionExpiresAt.toISOString(),
        ...(includeSamlSource && result.samlSourceMembership !== undefined
          ? { samlSourceMembership: result.samlSourceMembership }
          : {}),
      };
    } catch (error: unknown) {
      if (error instanceof RealtimeTicketNotFound) {
        throw new ProblemException({ status: 404, code: 'realtime-ticket.not-found' });
      }
      throw error;
    }
  }
  // #endregion
}
