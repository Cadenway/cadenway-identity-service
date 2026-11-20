import type { RealtimeTicket } from '@cadenway/contracts/types/internal/identity-service';
import { InternalAccess, ProblemException, getOrganizationContext } from '@cadenway/nest-common';
import { Body, Controller, Header, HttpCode, Post } from '@nestjs/common';

import { RealtimeOrganizationNotSelected } from '../../../../application/models/realtime-ticket/realtime-organization-not-selected.model.js';
import { OrganizationMfaRequired } from '../../../../application/models/session/organization-mfa-required.model.js';
import { OrganizationNotFound } from '../../../../application/models/session/organization-not-found.model.js';
import { SessionNotFound } from '../../../../application/models/session/session-not-found.model.js';
import { IssueRealtimeTicket } from '../../../../application/use-cases/commands/realtime-ticket/issue-realtime-ticket/issue-realtime-ticket.use-case.js';
import { IssueRealtimeTicketBody } from '../../dto/input/realtime-ticket/issue-realtime-ticket-body.dto.js';

/** Issues a single-use credential bound to the gateway's verified session and organization. */
@Controller('internal/v1/realtime/tickets')
@InternalAccess({ issuers: ['api-gateway'], actors: ['user'], organization: 'required' })
export class IssueRealtimeTicketController {
  // #region Constructor
  /** Binds the transactional ticket issuer. */
  public constructor(private readonly issue: IssueRealtimeTicket) {}
  // #endregion

  // #region Methods
  /** Returns only the credential and its exclusive expiry. */
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  public async execute(@Body() body: IssueRealtimeTicketBody): Promise<RealtimeTicket> {
    const context = getOrganizationContext();
    if (context?.actor.type !== 'user' || context.actor.id === null) {
      throw new ProblemException({ status: 403, code: 'auth.actor-not-allowed' });
    }
    if (context.organizationId === null) {
      throw new ProblemException({ status: 403, code: 'auth.organization-required' });
    }
    try {
      const result = await this.issue.execute({
        actorUserId: context.actor.id,
        organizationId: context.organizationId,
        sessionId: body.sessionId,
      });
      return { token: result.token, expiresAt: result.expiresAt.toISOString() };
    } catch (error: unknown) {
      if (error instanceof SessionNotFound) {
        throw new ProblemException({ status: 404, code: 'session.not-found' });
      }
      if (error instanceof OrganizationNotFound) {
        throw new ProblemException({ status: 404, code: 'organization.not-found' });
      }
      if (error instanceof RealtimeOrganizationNotSelected) {
        throw new ProblemException({ status: 403, code: 'organization.not-selected' });
      }
      if (error instanceof OrganizationMfaRequired) {
        throw new ProblemException({
          status: 403,
          code: 'organization.mfa-required',
          details: { organizationId: error.organizationId },
        });
      }
      throw error;
    }
  }
  // #endregion
}
