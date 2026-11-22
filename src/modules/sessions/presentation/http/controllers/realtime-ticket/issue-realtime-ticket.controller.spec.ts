import {
  IssueRealtimeTicketInternalBody,
  IssueRealtimeTicketInternalResponse,
  RedeemRealtimeTicketInternalBody,
  RedeemRealtimeTicketInternalResponse,
} from '@cadenway/contracts/validators/internal/identity-service';
import { ProblemException, runWithOrganizationContext } from '@cadenway/nest-common';
import type { OrganizationContext } from '@cadenway/nest-common';
import { describe, expect, it, vi } from 'vitest';

import { RealtimeTicketNotFound } from '../../../../application/models/realtime-ticket/realtime-ticket-not-found.model.js';
import { RealtimeOrganizationNotSelected } from '../../../../application/models/realtime-ticket/realtime-organization-not-selected.model.js';
import { OrganizationMfaRequired } from '../../../../application/models/session/organization-mfa-required.model.js';
import { OrganizationNotFound } from '../../../../application/models/session/organization-not-found.model.js';
import { SessionNotFound } from '../../../../application/models/session/session-not-found.model.js';
import type { IssueRealtimeTicket } from '../../../../application/use-cases/commands/realtime-ticket/issue-realtime-ticket/issue-realtime-ticket.use-case.js';
import type { RedeemRealtimeTicket } from '../../../../application/use-cases/commands/realtime-ticket/redeem-realtime-ticket/redeem-realtime-ticket.use-case.js';
import { IssueRealtimeTicketController } from './issue-realtime-ticket.controller.js';
import { RedeemRealtimeTicketController } from './redeem-realtime-ticket.controller.js';

const organizationId = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';
const userId = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';
const sessionId = '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60';
const memberId = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b31';
const token = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFA';
const user: OrganizationContext = {
  organizationId,
  actor: { type: 'user', id: userId },
  role: 'owner',
  scopes: [],
};
const system: OrganizationContext = {
  organizationId: null,
  actor: { type: 'system', id: null },
  role: null,
  scopes: [],
};

describe('realtime ticket HTTP adapters', () => {
  it('maps the verified user and session to the issuer and returns only the published fields', async () => {
    const execute = vi.fn().mockResolvedValue({
      token,
      expiresAt: new Date('2026-11-20T09:01:00.000Z'),
      internalField: 'not returned',
    });
    const controller = new IssueRealtimeTicketController({
      execute,
    } as unknown as IssueRealtimeTicket);
    const result = await runWithOrganizationContext(user, () => controller.execute({ sessionId }));
    expect(execute).toHaveBeenCalledExactlyOnceWith({
      actorUserId: userId,
      organizationId,
      sessionId,
    });
    expect(IssueRealtimeTicketInternalResponse.parse(result)).toEqual(result);
    expect(result).toEqual({ token, expiresAt: '2026-11-20T09:01:00.000Z' });
  });

  it.each([
    [new SessionNotFound(), 404, 'session.not-found'],
    [new OrganizationNotFound(), 404, 'organization.not-found'],
    [new RealtimeOrganizationNotSelected(), 403, 'organization.not-selected'],
    [new OrganizationMfaRequired(organizationId), 403, 'organization.mfa-required'],
  ])('maps issuance refusal %s to its contracted problem', async (refusal, status, code) => {
    const controller = new IssueRealtimeTicketController({
      execute: vi.fn().mockRejectedValue(refusal),
    } as unknown as IssueRealtimeTicket);
    const result = await runWithOrganizationContext(user, () =>
      controller.execute({ sessionId }).catch((error: unknown) => error),
    );
    expect(result).toBeInstanceOf(ProblemException);
    expect((result as ProblemException).problem).toMatchObject({ status, code });
    if (refusal instanceof OrganizationMfaRequired) {
      expect((result as ProblemException).problem.details).toEqual({ organizationId });
    }
  });

  it('maps a consumed ticket to the session contract without leaking internal fields', async () => {
    const execute = vi.fn().mockResolvedValue({
      sessionId,
      sessionVersion: 2,
      userId,
      organizationId,
      memberId,
      role: 'owner',
      sessionExpiresAt: new Date('2026-11-20T20:00:00.000Z'),
      internalField: 'not returned',
    });
    const controller = new RedeemRealtimeTicketController({
      execute,
    } as unknown as RedeemRealtimeTicket);
    const result = await runWithOrganizationContext(system, () => controller.execute({ token }));
    expect(execute).toHaveBeenCalledExactlyOnceWith({ token, verifiesSamlSource: false });
    expect(RedeemRealtimeTicketInternalResponse.parse(result)).toEqual(result);
    expect(result).not.toHaveProperty('internalField');
    expect(result.sessionExpiresAt).toBe('2026-11-20T20:00:00.000Z');
  });

  it('refuses an organization in the redemption context before consuming the ticket', async () => {
    const execute = vi.fn();
    const controller = new RedeemRealtimeTicketController({
      execute,
    } as unknown as RedeemRealtimeTicket);
    const result = await runWithOrganizationContext({ ...system, organizationId }, () =>
      controller.execute({ token }).catch((error: unknown) => error),
    );
    expect((result as ProblemException).problem).toMatchObject({
      status: 403,
      code: 'auth.organization-not-allowed',
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('uses a generic not-found problem for an unusable ticket', async () => {
    const controller = new RedeemRealtimeTicketController({
      execute: vi.fn().mockRejectedValue(new RealtimeTicketNotFound()),
    } as unknown as RedeemRealtimeTicket);
    const result = await runWithOrganizationContext(system, () =>
      controller.execute({ token }).catch((error: unknown) => error),
    );
    expect((result as ProblemException).problem).toMatchObject({
      status: 404,
      code: 'realtime-ticket.not-found',
    });
    expect(JSON.stringify((result as ProblemException).problem)).not.toContain(token);
  });

  it('uses closed published input validators for both request bodies', () => {
    expect(IssueRealtimeTicketInternalBody.safeParse({ sessionId }).success).toBe(true);
    expect(IssueRealtimeTicketInternalBody.safeParse({ sessionId, token }).success).toBe(false);
    expect(RedeemRealtimeTicketInternalBody.safeParse({ token }).success).toBe(true);
    expect(RedeemRealtimeTicketInternalBody.safeParse({ token, sessionId }).success).toBe(false);
  });
});
