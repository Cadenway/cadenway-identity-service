import { describe, expect, it } from 'vitest';

import {
  FakeApiTokenSecrets,
  FakeRecentAuthentications,
  FixedClock,
  InMemoryApiTokens,
} from '../api-tokens.fixture.js';
import { ReauthenticationRequired } from '../../../../models/api-token/reauthentication-required.model.js';
import { SessionNotFound } from '../../../../models/api-token/session-not-found.model.js';
import type { CreateApiTokenInput } from './create-api-token.input.js';
import type { CreateApiTokenOutput } from './create-api-token.output.js';
import { CreateApiToken } from './create-api-token.use-case.js';

const ATELIER_NORD = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';
const CAMILLE_ID = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';
const SESSION_ID = '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60';

describe('CreateApiToken', () => {
  it('stores the token in the organization of the session with the hash of its secret only', async () => {
    const store: InMemoryApiTokens = new InMemoryApiTokens();
    const created: CreateApiTokenOutput = await new CreateApiToken(
      store,
      new FakeApiTokenSecrets(),
      new FakeRecentAuthentications('recent'),
      new FixedClock('2026-11-08T14:02:00Z'),
    ).execute({
      actorUserId: CAMILLE_ID,
      organizationId: ATELIER_NORD,
      sessionId: SESSION_ID,
      name: ' Synchronisation GitLab ',
      scopes: ['tasks:read', 'tasks:read'],
      expiration: '30-days',
    });

    expect(created).toEqual({
      apiToken: {
        id: '019a6c30-7a8b-7c9d-8e0f-000000000001',
        name: 'Synchronisation GitLab',
        prefix: 'cw_pat_Test',
        scopes: ['tasks:read'],
        organizationId: ATELIER_NORD,
        createdAt: new Date('2026-11-08T14:02:00Z'),
        expiresAt: new Date('2026-12-08T14:02:00Z'),
        lastUsedAt: null,
      },
      secret: expect.stringMatching(/^cw_pat_[0-9A-Za-z]{36}$/u) as unknown,
    });
    const stored = store.rows.get(created.apiToken.id);
    expect(stored?.tokenHash).toBe(`hash:${created.secret}`);
    expect(JSON.stringify(stored?.state)).not.toContain(created.secret);
    expect(stored?.state).toMatchObject({ userId: CAMILLE_ID, version: 1, revokedAt: null });
  });
});

describe('CreateApiToken recent authentication', () => {
  const input: CreateApiTokenInput = {
    actorUserId: CAMILLE_ID,
    organizationId: ATELIER_NORD,
    sessionId: SESSION_ID,
    name: 'Synchronisation GitLab',
    scopes: ['tasks:read'],
    expiration: '30-days',
  };

  /**
   * The creation with sessions in a given status.
   *
   * @param store - The fake tokens.
   * @param sessions - The status of the sessions.
   * @returns The use case.
   */
  function creation(store: InMemoryApiTokens, sessions: FakeRecentAuthentications): CreateApiToken {
    return new CreateApiToken(
      store,
      new FakeApiTokenSecrets(),
      sessions,
      new FixedClock('2026-11-08T14:02:00Z'),
    );
  }

  it('refuses a request without the session, and creates nothing', async () => {
    const store: InMemoryApiTokens = new InMemoryApiTokens();
    const sessions: FakeRecentAuthentications = new FakeRecentAuthentications('recent');

    await expect(creation(store, sessions).execute({ ...input, sessionId: null })).rejects.toThrow(
      ReauthenticationRequired,
    );
    expect(store.rows.size).toBe(0);
    expect(sessions.checks).toBe(0);
  });

  it('refuses a session without a recent authentication, and creates nothing', async () => {
    const store: InMemoryApiTokens = new InMemoryApiTokens();
    const sessions: FakeRecentAuthentications = new FakeRecentAuthentications();
    sessions.set(CAMILLE_ID, SESSION_ID, 'stale');

    await expect(creation(store, sessions).execute(input)).rejects.toThrow(
      ReauthenticationRequired,
    );
    expect(store.rows.size).toBe(0);
  });

  it('refuses a session that is not an open session of the actor in the organization', async () => {
    const store: InMemoryApiTokens = new InMemoryApiTokens();

    await expect(
      creation(store, new FakeRecentAuthentications('not-found')).execute(input),
    ).rejects.toThrow(SessionNotFound);
    expect(store.rows.size).toBe(0);
  });

  it('creates the token for a session recently authenticated', async () => {
    const store: InMemoryApiTokens = new InMemoryApiTokens();
    const sessions: FakeRecentAuthentications = new FakeRecentAuthentications();
    sessions.set(CAMILLE_ID, SESSION_ID, 'recent');

    await expect(creation(store, sessions).execute(input)).resolves.toMatchObject({
      apiToken: { organizationId: ATELIER_NORD, name: 'Synchronisation GitLab' },
    });
    expect(store.rows.size).toBe(1);
    expect(sessions.checks).toBe(1);
  });
});
