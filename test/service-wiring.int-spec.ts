import { execFileSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { createApplication, InternalTokenSigner } from '@cadenway/nest-common';
import type { Ed25519PrivateJwk, Ed25519PublicJwk } from '@cadenway/nest-common';
import { Controller, Get, Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// The service as main.ts assembles it, on a disposable PostgreSQL. `@cadenway/nest-testing` does not
// export its container fixtures yet and a service never depends on `testcontainers` itself, so the
// database is the one of compose.dev.yaml, started as a throwaway Compose project on a free port.

/** Compose file of the development dependencies, whose PostgreSQL carries the two roles. */
const composeFile: string = fileURLToPath(new URL('../compose.dev.yaml', import.meta.url));

/** Throwaway project name: it never touches the data of the developer's own dev stack. */
const project = `cadenway-identity-service-test-${String(process.pid)}`;

/** Atelier Nord, the organization of the mockup. */
const atelierNordId = '01938f6e-6d1a-7c3e-9a51-2f0c4b8d7e10';

/** Camille Martin (CM), the member of Atelier Nord the mockup signs in as. */
const camilleMartinId = '01938f6e-8a42-7d5b-b2c9-5e1f3a6d9c24';

/**
 * Runs `docker compose` on the throwaway project.
 *
 * @param args - Compose command and its arguments.
 * @returns The standard output.
 */
function compose(...args: readonly string[]): string {
  return execFileSync(
    'docker',
    ['compose', '--project-name', project, '--file', composeFile, ...args],
    {
      encoding: 'utf8',
      env: { ...process.env, DEV_POSTGRES_PORT: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
}

/**
 * Creates an Ed25519 key pair in the JWK forms the internal token uses.
 *
 * @returns The public key for the verifier and the private key for a signer.
 */
function keyPair(): {
  readonly publicJwk: Ed25519PublicJwk;
  readonly privateJwk: Ed25519PrivateJwk;
} {
  const { x, d } = generateKeyPairSync('ed25519').privateKey.export({ format: 'jwk' });
  if (x === undefined || d === undefined) {
    throw new Error('Node returned an Ed25519 JWK without its key material.');
  }
  const publicJwk: Ed25519PublicJwk = { kty: 'OKP', crv: 'Ed25519', x, kid: 'test-api-gateway' };
  return { publicJwk, privateJwk: { ...publicJwk, d } };
}

/** A route of the application that declares no exemption, like every business route will. */
@Controller('internal/v1/wiring-probe')
class WiringProbeController {
  @Get()
  public probe(): { readonly reached: true } {
    return { reached: true };
  }
}

describe('identity-service wiring', () => {
  const gateway = keyPair();
  let app: NestExpressApplication;
  let signer: InternalTokenSigner;

  beforeAll(async () => {
    compose('up', '--detach', '--wait', '--wait-timeout', '120', 'postgres');
    const port = compose('port', 'postgres', '5432').trim().split(':').at(-1) ?? '';

    vi.stubEnv('PORT', '3010');
    vi.stubEnv('LOG_PRETTY', 'false');
    vi.stubEnv('DATABASE_URL', `postgres://identity_app:identity_app@127.0.0.1:${port}/identity`);
    vi.stubEnv('INTERNAL_TOKEN_AUDIENCE', 'identity-service');
    vi.stubEnv(
      'INTERNAL_TOKEN_TRUSTED_ISSUERS',
      JSON.stringify({ 'api-gateway': [gateway.publicJwk] }),
    );
    // The configuration is validated when these modules are first imported, as in main.ts.
    const { config } = await import('../src/config/config.js');
    const { AppModule } = await import('../src/app.module.js');

    @Module({ imports: [AppModule], controllers: [WiringProbeController] })
    class ProbedApplicationModule {}

    app = await createApplication(ProbedApplicationModule, {
      service: 'identity-service',
      config,
      internalToken: {
        verifier: {
          audience: config.INTERNAL_TOKEN_AUDIENCE,
          trustedIssuers: config.INTERNAL_TOKEN_TRUSTED_ISSUERS,
        },
      },
      logDestination: { write: (): void => undefined },
    });
    await app.init();
    signer = await InternalTokenSigner.create({
      issuer: 'api-gateway',
      privateJwk: gateway.privateJwk,
    });
  });

  afterAll(async () => {
    try {
      await app.close();
    } finally {
      vi.unstubAllEnvs();
      compose('down', '--volumes', '--remove-orphans');
    }
  });

  it('answers the liveness probe without a token', async () => {
    const response = await request(app.getHttpServer()).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok' });
  });

  it('is ready once its database answers as the application role', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      details: { postgres: { status: 'up' } },
    });
  });

  it('refuses a route of the application without an internal token', async () => {
    const response = await request(app.getHttpServer()).get('/internal/v1/wiring-probe');

    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/u);
    expect(response.body).toMatchObject({ status: 401, code: 'auth.token-missing' });
  });

  it('serves a route to a trusted issuer acting for a member of the organization', async () => {
    const token = await signer.sign('identity-service', {
      actor: { type: 'user', id: camilleMartinId },
      organizationId: atelierNordId,
    });

    const response = await request(app.getHttpServer())
      .get('/internal/v1/wiring-probe')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ reached: true });
  });

  it('refuses a token signed for another service', async () => {
    const token = await signer.sign('document-service', {
      actor: { type: 'user', id: camilleMartinId },
      organizationId: atelierNordId,
    });

    const response = await request(app.getHttpServer())
      .get('/internal/v1/wiring-probe')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      code: 'auth.token-invalid',
      details: { reason: 'audience' },
    });
  });

  it('stops being ready when its database is down', async () => {
    compose('stop', 'postgres');

    const response = await request(app.getHttpServer()).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: 'error',
      error: { postgres: { status: 'down' } },
    });
  });
});
