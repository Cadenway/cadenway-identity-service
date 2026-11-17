import { describe, expect, it } from 'vitest';

import { InvalidApiTokenError } from '../../errors/api-token/invalid-api-token.error.js';
import type { ApiTokenDraft } from '../../value-objects/api-token/api-token-draft.value-object.js';
import type { ApiTokenRequest } from '../../value-objects/api-token/api-token-request.value-object.js';
import { ApiToken } from './api-token.aggregate.js';

const CREATED_AT = new Date('2026-11-08T14:02:00Z');
const MINUTE = 60_000;
const REQUEST: ApiTokenRequest = {
  organizationId: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f',
  userId: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
  name: '  Synchronisation GitLab  ',
  scopes: ['tasks:read'],
  expiration: '30-days',
  prefix: 'cw_pat_Exam',
};

/**
 * The token of the request, stored.
 *
 * @param request - What the session asked for.
 * @returns The stored token.
 */
function stored(request: ApiTokenRequest = REQUEST): ApiToken {
  const draft: ApiTokenDraft = ApiToken.create(request, CREATED_AT);
  return ApiToken.restore({ ...draft, id: '019a6c30-7a8b-7c9d-8e0f-1a2b3c4d5e90' });
}

describe('ApiToken', () => {
  it('is created with its trimmed name, at version 1, never used, for 30 days by default', () => {
    expect(ApiToken.create(REQUEST, CREATED_AT)).toEqual({
      organizationId: REQUEST.organizationId,
      userId: REQUEST.userId,
      name: 'Synchronisation GitLab',
      prefix: 'cw_pat_Exam',
      scopes: ['tasks:read'],
      createdAt: CREATED_AT,
      expiresAt: new Date('2026-12-08T14:02:00Z'),
      lastUsedAt: null,
      revokedAt: null,
      version: 1,
    });
  });

  it('expires after 90 days, a calendar year, or never', () => {
    expect(ApiToken.create({ ...REQUEST, expiration: '90-days' }, CREATED_AT).expiresAt).toEqual(
      new Date('2027-02-06T14:02:00Z'),
    );
    expect(ApiToken.create({ ...REQUEST, expiration: '1-year' }, CREATED_AT).expiresAt).toEqual(
      new Date('2027-11-08T14:02:00Z'),
    );
    expect(ApiToken.create({ ...REQUEST, expiration: 'never' }, CREATED_AT).expiresAt).toBeNull();
  });

  it('counts a scope given twice once', () => {
    expect(
      ApiToken.create(
        { ...REQUEST, scopes: ['members:read', 'tasks:read', 'members:read'] },
        CREATED_AT,
      ).scopes,
    ).toEqual(['members:read', 'tasks:read']);
  });

  it('refuses a blank or too long name, no scope, an unknown scope and a wrong prefix', () => {
    for (const request of [
      { ...REQUEST, name: '   ' },
      { ...REQUEST, name: 'x'.repeat(101) },
      { ...REQUEST, scopes: [] },
      { ...REQUEST, scopes: ['tasks:delete'] },
      { ...REQUEST, prefix: 'cw_pat_' },
    ]) {
      expect(() => ApiToken.create(request, CREATED_AT)).toThrow(InvalidApiTokenError);
    }
  });

  it('works until it expires, and never once revoked', () => {
    const token: ApiToken = stored();

    expect(token.isActiveAt(new Date('2026-12-08T14:01:59Z'))).toBe(true);
    expect(token.isActiveAt(new Date('2026-12-08T14:02:00Z'))).toBe(false);
    expect(stored({ ...REQUEST, expiration: 'never' }).isActiveAt(new Date('2099-01-01'))).toBe(
      true,
    );
    expect(token.revoke(CREATED_AT).isActiveAt(CREATED_AT)).toBe(false);
  });

  it('revokes with the next version, and changes nothing the second time', () => {
    const revoked: ApiToken = stored().revoke(new Date(CREATED_AT.getTime() + MINUTE));

    expect(revoked.snapshot).toMatchObject({
      version: 2,
      revokedAt: new Date('2026-11-08T14:03:00Z'),
    });
    expect(revoked.revoke(new Date(CREATED_AT.getTime() + 2 * MINUTE))).toBe(revoked);
  });

  it('records its use at most once a minute, without a new version', () => {
    const used: ApiToken = stored().recordUse(CREATED_AT);

    expect(used.snapshot).toMatchObject({ lastUsedAt: CREATED_AT, version: 1 });
    expect(used.recordUse(new Date(CREATED_AT.getTime() + MINUTE - 1))).toBe(used);
    expect(used.recordUse(new Date(CREATED_AT.getTime() + MINUTE)).snapshot.lastUsedAt).toEqual(
      new Date('2026-11-08T14:03:00Z'),
    );
  });

  it('belongs to its user in its organization only', () => {
    const token: ApiToken = stored();

    expect(token.belongsTo(REQUEST.userId, REQUEST.organizationId)).toBe(true);
    expect(token.belongsTo(REQUEST.organizationId, REQUEST.organizationId)).toBe(false);
    expect(token.belongsTo(REQUEST.userId, REQUEST.userId)).toBe(false);
  });

  it('refuses a stored token without a positive version', () => {
    expect(() => ApiToken.restore({ ...stored().snapshot, version: 0 })).toThrow(
      InvalidApiTokenError,
    );
  });
});
