import { generateKeyPairSync } from 'node:crypto';

import { createApplication, InternalTokenSigner } from '@cadenway/nest-common';
import type { Ed25519PrivateJwk, Ed25519PublicJwk } from '@cadenway/nest-common';
import { Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { IssueRealtimeTicket } from '../../../../application/use-cases/commands/realtime-ticket/issue-realtime-ticket/issue-realtime-ticket.use-case.js';
import { RedeemRealtimeTicket } from '../../../../application/use-cases/commands/realtime-ticket/redeem-realtime-ticket/redeem-realtime-ticket.use-case.js';
import { IssueRealtimeTicketController } from './issue-realtime-ticket.controller.js';
import { RedeemRealtimeTicketController } from './redeem-realtime-ticket.controller.js';

const userId = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';
const organizationId = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';
const sessionId = '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60';
const memberId = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b31';
const ticket = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFA';
const issue = vi
  .fn()
  .mockResolvedValue({ token: ticket, expiresAt: new Date('2026-11-20T09:01:00Z') });
const redeem = vi.fn().mockResolvedValue({
  sessionId,
  sessionVersion: 2,
  userId,
  organizationId,
  memberId,
  role: 'owner',
  sessionExpiresAt: new Date('2026-11-20T20:00:00Z'),
});

@Module({
  controllers: [IssueRealtimeTicketController, RedeemRealtimeTicketController],
  providers: [
    { provide: IssueRealtimeTicket, useValue: { execute: issue } },
    { provide: RedeemRealtimeTicket, useValue: { execute: redeem } },
  ],
})
class TicketHttpTestModule {}

/** Creates test-only Ed25519 credentials for one trusted issuer. */
function keyPair(kid: string): { publicJwk: Ed25519PublicJwk; privateJwk: Ed25519PrivateJwk } {
  const { x, d } = generateKeyPairSync('ed25519').privateKey.export({ format: 'jwk' });
  if (x === undefined || d === undefined) throw new Error('Missing generated key material.');
  const publicJwk: Ed25519PublicJwk = { kty: 'OKP', crv: 'Ed25519', x, kid };
  return { publicJwk, privateJwk: { ...publicJwk, d } };
}

describe('signed realtime ticket routes', () => {
  let app: NestExpressApplication;
  let gateway: InternalTokenSigner;
  let realtime: InternalTokenSigner;

  beforeAll(async () => {
    const gatewayKeys = keyPair('gateway-test');
    const realtimeKeys = keyPair('realtime-test');
    app = await createApplication(TicketHttpTestModule, {
      service: 'identity-service',
      internalToken: {
        verifier: {
          audience: 'identity-service',
          trustedIssuers: {
            'api-gateway': [gatewayKeys.publicJwk],
            'realtime-gateway': [realtimeKeys.publicJwk],
          },
        },
      },
      logDestination: { write: (): void => undefined },
    });
    await app.init();
    gateway = await InternalTokenSigner.create({
      issuer: 'api-gateway',
      privateJwk: gatewayKeys.privateJwk,
    });
    realtime = await InternalTokenSigner.create({
      issuer: 'realtime-gateway',
      privateJwk: realtimeKeys.privateJwk,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires an authorized gateway user and validates the closed issuance body', async () => {
    const auth = await gateway.sign('identity-service', {
      actor: { type: 'user', id: userId },
      organizationId,
    });
    const good = await request(app.getHttpServer())
      .post('/internal/v1/realtime/tickets')
      .set('Authorization', `Bearer ${auth}`)
      .send({ sessionId });
    expect(good.status).toBe(200);
    expect(good.headers['cache-control']).toBe('no-store');
    expect(good.body).toMatchObject({ token: ticket, expiresAt: '2026-11-20T09:01:00.000Z' });
    const extra = await request(app.getHttpServer())
      .post('/internal/v1/realtime/tickets')
      .set('Authorization', `Bearer ${auth}`)
      .send({ sessionId, token: ticket });
    expect(extra.status).toBe(400);
    const wrongActor = await realtime.sign('identity-service', {
      actor: { type: 'system', id: null },
      organizationId: null,
    });
    const refused = await request(app.getHttpServer())
      .post('/internal/v1/realtime/tickets')
      .set('Authorization', `Bearer ${wrongActor}`)
      .send({ sessionId });
    expect(refused.status).toBe(403);
  });

  it('allows the realtime system only without an organization', async () => {
    const auth = await realtime.sign('identity-service', {
      actor: { type: 'system', id: null },
      organizationId: null,
    });
    const good = await request(app.getHttpServer())
      .post('/internal/v1/realtime/tickets/redemption')
      .set('Authorization', `Bearer ${auth}`)
      .send({ token: ticket });
    expect(good.status).toBe(200);
    expect(good.headers['cache-control']).toBe('no-store');
    expect(good.body).toMatchObject({ sessionId, organizationId, userId, memberId });
    const scoped = await realtime.sign('identity-service', {
      actor: { type: 'system', id: null },
      organizationId,
    });
    const refused = await request(app.getHttpServer())
      .post('/internal/v1/realtime/tickets/redemption')
      .set('Authorization', `Bearer ${scoped}`)
      .send({ token: ticket });
    expect(refused.status).toBe(403);
    expect(refused.body).toMatchObject({ code: 'auth.organization-not-allowed' });
    const extra = await request(app.getHttpServer())
      .post('/internal/v1/realtime/tickets/redemption')
      .set('Authorization', `Bearer ${auth}`)
      .send({ token: ticket, sessionId });
    expect(extra.status).toBe(400);
  });
});
