import { generateKeyPairSync } from 'node:crypto';
import { createServer } from 'node:http';

import type { SearchMembership } from '@cadenway/contracts/types/internal/organization-service';
import { ReserveAccountDeletionInternalParams } from '@cadenway/contracts/validators/internal/organization-service';
import { InternalTokenVerifier } from '@cadenway/nest-common';
import type { Ed25519PublicJwk } from '@cadenway/nest-common';

/** Serves the membership proof over loopback using a signing key generated for this run. */
export async function startOrganizationMembershipAuthority(
  find: (organizationId: string, userId: string) => Promise<SearchMembership | null>,
  reserve?: (userId: string, attemptId: string) => readonly string[],
): Promise<{ origin: string; privateJwk: string; close: () => Promise<void> }> {
  const { x, d } = generateKeyPairSync('ed25519').privateKey.export({ format: 'jwk' });
  if (x === undefined || d === undefined) throw new Error('Missing generated key material.');
  const publicJwk: Ed25519PublicJwk = {
    kty: 'OKP',
    crv: 'Ed25519',
    kid: 'organization-membership-test',
    x,
  };
  const verifier = await InternalTokenVerifier.create({
    audience: 'organization-service',
    trustedIssuers: { 'identity-service': [publicJwk] },
  });
  const attempts = new Map<string, string>();
  const server = createServer((request, response) => {
    const token = request.headers.authorization;
    const match =
      request.method === 'PUT'
        ? /^\/internal\/v1\/users\/([^/]+)\/account-deletion-reservations\/([^/]+)$/.exec(
            request.url ?? '',
          )
        : null;
    if (match !== null) response.setHeader('Cache-Control', 'private, no-store');
    if (token?.startsWith('Bearer ') !== true) {
      response.writeHead(400).end();
      return;
    }
    void verifier
      .verify(token.slice(7))
      .then(async (principal) => {
        if (match !== null && reserve !== undefined) {
          if (
            principal.actor.type !== 'system' ||
            principal.actor.id !== 'identity-service' ||
            principal.organizationId !== null ||
            principal.role !== null ||
            principal.scopes.length !== 0
          ) {
            response.writeHead(403).end();
            return;
          }
          const { userId, attemptId } = ReserveAccountDeletionInternalParams.parse({
            userId: match[1],
            attemptId: match[2],
          });
          const previous = attempts.get(userId);
          if (previous !== undefined) {
            response.writeHead(previous === attemptId ? 204 : 409).end();
            return;
          }
          const organizationIds = reserve(userId, attemptId);
          if (organizationIds.length > 0) {
            response.writeHead(409, { 'Content-Type': 'application/problem+json' }).end(
              JSON.stringify({
                type: 'about:blank',
                title: 'Conflict',
                status: 409,
                code: 'account.organization-owner',
                details: { organizationIds },
              }),
            );
            return;
          }
          attempts.set(userId, attemptId);
          response.writeHead(201).end();
          return;
        }
        if (request.method !== 'GET' || request.url !== '/internal/v1/search-membership') {
          response.writeHead(400).end();
          return;
        }
        if (
          principal.actor.type !== 'user' ||
          principal.actor.id === null ||
          principal.organizationId === null ||
          principal.role !== null ||
          principal.scopes.length !== 0
        ) {
          response.writeHead(403).end();
          return;
        }
        const membership = await find(principal.organizationId, principal.actor.id);
        if (membership === null) {
          response.writeHead(404, { 'Content-Type': 'application/problem+json' }).end(
            JSON.stringify({
              type: 'about:blank',
              title: 'Organization not found',
              status: 404,
              code: 'organization.not-found',
            }),
          );
          return;
        }
        response
          .writeHead(200, { 'Content-Type': 'application/json' })
          .end(JSON.stringify(membership));
      })
      .catch(() => {
        response.writeHead(503).end();
      });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('The membership authority has no TCP address.');
  }
  return {
    origin: `http://127.0.0.1:${String(address.port)}`,
    privateJwk: JSON.stringify({ ...publicJwk, d }),
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error === undefined) resolve();
          else reject(error);
        });
      }),
  };
}
