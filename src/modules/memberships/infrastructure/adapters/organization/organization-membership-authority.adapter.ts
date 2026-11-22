import type { SearchMembership } from '@cadenway/contracts/types/internal/organization-service';
import { GetSearchMembershipInternalResponse } from '@cadenway/contracts/validators/internal/organization-service';
import { ProblemException, type InternalTokenSigner } from '@cadenway/nest-common';
import { assertNoActiveTransaction } from '@cadenway/nest-common/database';
import { z } from 'zod';

const membershipPath = '/internal/v1/search-membership';
const timeoutMs = 1_000;
const responseLimitBytes = 16 * 1024;

const absentMembership = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  status: z.literal(404),
  code: z.literal('organization.not-found'),
});

async function readJson(response: Response): Promise<unknown> {
  if (response.body === null) throw new Error('Missing membership response body.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let body = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > responseLimitBytes) throw new Error('Membership response body too large.');
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode()) as unknown;
  } finally {
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Reads the current membership of the actor in the tenant signed by Identity. */
export class OrganizationMembershipAuthority {
  // #region Properties
  /** The fixed internal route on the operator-supplied Organization service origin. */
  private readonly endpoint: string;

  /** Signs a call for the verified user and tenant. */
  private readonly signer: Pick<InternalTokenSigner, 'sign'>;

  /** Native HTTP transport, injectable for tests. */
  private readonly fetcher: typeof fetch;
  // #endregion

  // #region Constructor
  /** Binds the route to a trusted origin and an Identity signer. */
  public constructor(
    origin: string,
    signer: Pick<InternalTokenSigner, 'sign'>,
    fetcher: typeof fetch = globalThis.fetch,
  ) {
    this.endpoint = new URL(membershipPath, origin).href;
    this.signer = signer;
    this.fetcher = fetcher;
  }
  // #endregion

  // #region Methods
  /** Returns null only for the authority's confirmed absence of an active membership. */
  public async find(
    organizationId: string,
    userId: string,
  ): Promise<Pick<SearchMembership, 'memberId' | 'role'> | null> {
    assertNoActiveTransaction();
    try {
      const token = await this.signer.sign('organization-service', {
        actor: { type: 'user', id: userId },
        organizationId,
        scopes: [],
      });
      const response = await this.fetcher(this.endpoint, {
        method: 'GET',
        headers: {
          accept: 'application/json, application/problem+json',
          authorization: `Bearer ${token}`,
        },
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      });
      const mediaType = response.headers
        .get('content-type')
        ?.split(';', 1)[0]
        ?.trim()
        .toLowerCase();
      if (response.status === 200 && mediaType === 'application/json') {
        const { memberId, role } = GetSearchMembershipInternalResponse.parse(
          await readJson(response),
        );
        return { memberId, role };
      }
      if (response.status === 404 && mediaType === 'application/problem+json') {
        absentMembership.parse(await readJson(response));
        return null;
      }
      void response.body?.cancel().catch(() => undefined);
    } catch {
      // Transport, JWT and schema errors may contain upstream data. Keep the public error fixed.
    }
    throw new ProblemException({ status: 503, code: 'organization.unavailable' });
  }
  // #endregion
}
