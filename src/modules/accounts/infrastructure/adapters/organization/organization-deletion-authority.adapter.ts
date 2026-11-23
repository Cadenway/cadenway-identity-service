import { ReserveAccountDeletionInternalParams } from '@cadenway/contracts/validators/internal/organization-service';
import type { InternalTokenSigner } from '@cadenway/nest-common';
import { assertNoActiveTransaction } from '@cadenway/nest-common/database';
import { z } from 'zod';

import type { AccountDeletionAuthority } from '../../../application/ports/outbound/memberships/accounts/account-deletion-authority.port.js';

const ownerRefusal = z.object({
  type: z.string(),
  title: z.string(),
  status: z.literal(409),
  code: z.literal('account.organization-owner'),
  details: z.object({ organizationIds: z.array(z.uuid()).nonempty() }),
});
const maximumProblemBytes = 64 * 1024;

async function isOwnerRefusal(response: Response): Promise<boolean> {
  const mediaType = response.headers.get('content-type')?.split(';', 1)[0]?.trim();
  if (mediaType?.toLowerCase() !== 'application/problem+json' || response.body === null) {
    void response.body?.cancel().catch(() => undefined);
    return false;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let body = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximumProblemBytes) return false;
      body += decoder.decode(value, { stream: true });
    }
    return ownerRefusal.safeParse(JSON.parse(body + decoder.decode())).success;
  } finally {
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Confirms the exact account deletion attempt using the published Organization operation. */
export class OrganizationDeletionAuthority implements AccountDeletionAuthority {
  // #region Constructor
  /** Binds the configured Organization origin and the Identity service signer. */
  public constructor(
    private readonly origin: string,
    private readonly signer: Pick<InternalTokenSigner, 'sign'>,
    private readonly fetcher: typeof fetch = globalThis.fetch,
  ) {}
  // #endregion

  // #region Methods
  /** Accepts only a confirmation for this attempt or a definitive owner refusal. */
  public async reserve(userId: string, attemptId: string): Promise<'reserved' | 'owner'> {
    assertNoActiveTransaction();
    const path = ReserveAccountDeletionInternalParams.parse({ userId, attemptId });
    const endpoint = new URL(
      `/internal/v1/users/${path.userId}/account-deletion-reservations/${path.attemptId}`,
      this.origin,
    );
    try {
      const token = await this.signer.sign('organization-service', {
        actor: { type: 'system', id: 'identity-service' },
        organizationId: null,
        scopes: [],
      });
      const response = await this.fetcher(endpoint, {
        method: 'PUT',
        headers: {
          accept: 'application/problem+json',
          authorization: `Bearer ${token}`,
        },
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(1_000),
      });
      if (response.status === 409) {
        if (await isOwnerRefusal(response)) return 'owner';
      } else {
        void response.body?.cancel().catch(() => undefined);
        if (response.status === 201 || response.status === 204) return 'reserved';
      }
    } catch {
      // Send only a fixed error to the retry worker.
    }
    throw new Error('Organization deletion authority unavailable.');
  }
  // #endregion
}
