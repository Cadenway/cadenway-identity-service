import { describe, expect, it, vi } from 'vitest';

import type { RealtimeTicket } from '../../../../../domain/aggregates/realtime-ticket/realtime-ticket.aggregate.js';
import { Session } from '../../../../../domain/aggregates/session/session.aggregate.js';
import { RealtimeOrganizationNotSelected } from '../../../../models/realtime-ticket/realtime-organization-not-selected.model.js';
import { RealtimeTicketNotFound } from '../../../../models/realtime-ticket/realtime-ticket-not-found.model.js';
import { OrganizationMfaRequired } from '../../../../models/session/organization-mfa-required.model.js';
import { SessionNotFound } from '../../../../models/session/session-not-found.model.js';
import type { ActiveMembership } from '../../../../models/session/active-membership.model.js';
import type { RealtimeTicketAccessPort } from '../../../../ports/outbound/memberships/realtime-ticket/realtime-ticket-access.port.js';
import type { RealtimeTicketUnitOfWork } from '../../../../ports/outbound/transactions/realtime-ticket/realtime-ticket-unit-of-work.port.js';
import { RedeemRealtimeTicket } from '../redeem-realtime-ticket/redeem-realtime-ticket.use-case.js';
import { IssueRealtimeTicket } from './issue-realtime-ticket.use-case.js';

const now = new Date('2026-11-20T09:00:00Z');
const userId = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';
const sessionId = '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60';
const membership = {
  organizationId: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f',
  memberId: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b31',
  role: 'owner' as const,
};
const token = 'A'.repeat(43);
const tokenHash = 'a'.repeat(64);

/** Provides test ports while retaining the aggregate behavior. */
function fixture() {
  let session = Session.restore({
    ...Session.start(userId, false, now, membership),
    id: sessionId,
    revokedAt: null,
    inactivityTimeoutMinutes: Session.DEFAULT_INACTIVITY_TIMEOUT_MINUTES,
  });
  let ticket: RealtimeTicket | null = null;
  const order: string[] = [];
  const sessions = {
    findById: vi.fn(() => Promise.resolve(session)),
    findForUpdate: vi.fn(() => {
      order.push('session');
      return Promise.resolve(session);
    }),
  };
  const tickets = {
    find: vi.fn(() => {
      order.push('discover');
      return Promise.resolve(ticket);
    }),
    findForUpdate: vi.fn(() => {
      order.push('ticket');
      return Promise.resolve(ticket);
    }),
    insert: vi.fn((value: RealtimeTicket) => {
      ticket = value;
      return Promise.resolve();
    }),
    consume: vi.fn((value: RealtimeTicket) => {
      ticket = value;
      return Promise.resolve();
    }),
  };
  const work: RealtimeTicketUnitOfWork = { run: async (fn) => fn({ sessions, tickets }) };
  const access: RealtimeTicketAccessPort = {
    resolveForUpdate: vi.fn(() => {
      order.push('access');
      return Promise.resolve({ status: 'allowed' as const, membership });
    }),
  };
  const tokens = {
    issue: vi.fn(() => ({ token, tokenHash })),
    hashOf: vi.fn((presented: string) => (presented === token ? tokenHash : null)),
  };
  const clock = { now: vi.fn(() => now) };
  const authority = { find: vi.fn(() => Promise.resolve<ActiveMembership | null>(membership)) };
  return {
    access,
    authority,
    clock,
    issue: new IssueRealtimeTicket(work, access, tokens, clock),
    redeem: new RedeemRealtimeTicket(work, access, tokens, clock, authority),
    order,
    tickets,
    tokens,
    setSession: (value: Session) => {
      session = value;
    },
  };
}

describe('realtime ticket commands', () => {
  it('stores only the digest and redeems once with the current membership role', async () => {
    const f = fixture();
    const issued = await f.issue.execute({
      actorUserId: userId,
      organizationId: membership.organizationId,
      sessionId,
    });
    expect(issued).toEqual({ token, expiresAt: new Date(now.getTime() + 60_000) });
    expect(f.tickets.insert.mock.calls[0]?.[0].snapshot).toMatchObject({
      tokenHash,
      userId,
      sessionId,
    });
    f.order.length = 0;
    await expect(f.redeem.execute({ token })).resolves.toMatchObject({
      userId,
      sessionId,
      organizationId: membership.organizationId,
      memberId: membership.memberId,
      role: 'owner',
    });
    expect(f.order).toEqual(['discover', 'access', 'session', 'ticket']);
    f.order.length = 0;
    await expect(f.redeem.execute({ token })).rejects.toThrow(RealtimeTicketNotFound);
    expect(f.order).toEqual(['discover']);
  });

  it('refuses a foreign or ended session and a different selected organization', async () => {
    const f = fixture();
    await expect(
      f.issue.execute({
        actorUserId: 'another',
        organizationId: membership.organizationId,
        sessionId,
      }),
    ).rejects.toThrow(SessionNotFound);
    await expect(
      f.issue.execute({ actorUserId: userId, organizationId: 'another', sessionId }),
    ).rejects.toThrow(RealtimeOrganizationNotSelected);
    expect(f.tokens.issue).not.toHaveBeenCalled();
  });

  it('does not issue or reveal a ticket when current MFA access is withheld', async () => {
    const f = fixture();
    vi.spyOn(f.access, 'resolveForUpdate').mockResolvedValue({ status: 'mfa-required' });
    await expect(
      f.issue.execute({
        actorUserId: userId,
        organizationId: membership.organizationId,
        sessionId,
      }),
    ).rejects.toThrow(OrganizationMfaRequired);
    expect(f.tickets.insert).not.toHaveBeenCalled();
  });

  it('refuses a removed member before consuming a ticket even while the projection is active', async () => {
    const f = fixture();
    await f.issue.execute({
      actorUserId: userId,
      organizationId: membership.organizationId,
      sessionId,
    });
    f.authority.find.mockResolvedValue(null);

    await expect(f.redeem.execute({ token })).rejects.toThrow(RealtimeTicketNotFound);
    expect(f.tickets.consume).not.toHaveBeenCalled();
  });

  it('refuses a ticket when the authoritative role differs from the projected policy role', async () => {
    const f = fixture();
    await f.issue.execute({
      actorUserId: userId,
      organizationId: membership.organizationId,
      sessionId,
    });
    f.authority.find.mockResolvedValue({ ...membership, role: 'member' });

    await expect(f.redeem.execute({ token })).rejects.toThrow(RealtimeTicketNotFound);
    expect(f.tickets.consume).not.toHaveBeenCalled();
  });

  it('refuses a ticket after removal from the SAML organization that opened the session', async () => {
    const f = fixture();
    f.setSession(
      Session.restore({
        ...Session.start(userId, false, now, membership),
        id: sessionId,
        revokedAt: null,
        inactivityTimeoutMinutes: Session.DEFAULT_INACTIVITY_TIMEOUT_MINUTES,
        samlMembership: { organizationId: 'source-organization', memberId: 'source-member' },
      }),
    );
    await f.issue.execute({
      actorUserId: userId,
      organizationId: membership.organizationId,
      sessionId,
    });
    f.authority.find.mockResolvedValueOnce(membership).mockResolvedValueOnce(null);

    await expect(f.redeem.execute({ token, verifiesSamlSource: true })).rejects.toThrow(
      RealtimeTicketNotFound,
    );
    expect(f.tickets.consume).not.toHaveBeenCalled();
  });

  it('includes the proven SAML source when a ticket is redeemed', async () => {
    const f = fixture();
    f.setSession(
      Session.restore({
        ...Session.start(userId, false, now, membership),
        id: sessionId,
        revokedAt: null,
        inactivityTimeoutMinutes: Session.DEFAULT_INACTIVITY_TIMEOUT_MINUTES,
        samlMembership: { organizationId: 'source-organization', memberId: 'source-member' },
      }),
    );
    await f.issue.execute({
      actorUserId: userId,
      organizationId: membership.organizationId,
      sessionId,
    });
    f.authority.find.mockResolvedValueOnce(membership).mockResolvedValueOnce({
      organizationId: 'source-organization',
      memberId: 'source-member',
      role: 'member',
    });

    await expect(f.redeem.execute({ token })).rejects.toThrow(RealtimeTicketNotFound);
    expect(f.tickets.consume).not.toHaveBeenCalled();
    await expect(f.redeem.execute({ token, verifiesSamlSource: true })).resolves.toMatchObject({
      samlSourceMembership: { organizationId: 'source-organization', memberId: 'source-member' },
    });
  });

  it('rechecks the clock after locks and refuses a ticket expired while waiting', async () => {
    const f = fixture();
    await f.issue.execute({
      actorUserId: userId,
      organizationId: membership.organizationId,
      sessionId,
    });
    f.clock.now.mockReturnValue(new Date(now.getTime() + 60_000));
    await expect(f.redeem.execute({ token })).rejects.toThrow(RealtimeTicketNotFound);
    expect(f.tickets.consume).not.toHaveBeenCalled();
  });

  it('refuses a ticket when the session binding or membership changes', async () => {
    const f = fixture();
    await f.issue.execute({
      actorUserId: userId,
      organizationId: membership.organizationId,
      sessionId,
    });
    const other = { ...membership, organizationId: 'other', memberId: 'other-member' };
    const original = Session.restore({
      ...Session.start(userId, false, now, membership),
      id: sessionId,
      revokedAt: null,
      inactivityTimeoutMinutes: Session.DEFAULT_INACTIVITY_TIMEOUT_MINUTES,
    });
    f.setSession(original.chooseOrganization(other, new Date(now.getTime() + 1)));
    await expect(f.redeem.execute({ token })).rejects.toThrow(RealtimeTicketNotFound);
    expect(f.tickets.consume).not.toHaveBeenCalled();
  });

  it('rechecks the selected organization after waiting for the policy lock', async () => {
    const f = fixture();
    const original = Session.restore({
      ...Session.start(userId, false, now, membership),
      id: sessionId,
      revokedAt: null,
      inactivityTimeoutMinutes: Session.DEFAULT_INACTIVITY_TIMEOUT_MINUTES,
    });
    vi.spyOn(f.access, 'resolveForUpdate').mockImplementation(() => {
      f.setSession(
        original.chooseOrganization(
          { organizationId: 'other', memberId: 'other-member' },
          new Date(now.getTime() + 1),
        ),
      );
      return Promise.resolve({ status: 'allowed', membership });
    });
    await expect(
      f.issue.execute({
        actorUserId: userId,
        organizationId: membership.organizationId,
        sessionId,
      }),
    ).rejects.toThrow(RealtimeOrganizationNotSelected);
    expect(f.tickets.insert).not.toHaveBeenCalled();
  });
});
