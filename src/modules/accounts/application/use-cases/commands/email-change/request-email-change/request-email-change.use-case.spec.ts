import { beforeEach, describe, expect, it } from 'vitest';

import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import type { OneTimeCodeState } from '../../../../../domain/aggregates/one-time-codes/one-time-code-state.aggregate.js';
import {
  FakeAccountSessions,
  FakeCodeSecrets,
  FixedClock,
  InMemoryAccounts,
} from '../../../../models/accounts/accounts.fixture.js';
import type { RecordedEvent } from '../../../../models/accounts/accounts.fixture.js';
import type { CodeSentView } from '../../../../projections/authentication/code-sent-view.projection.js';
import type { RequestEmailChangeInput } from './request-email-change.input.js';
import { RequestEmailChange } from './request-email-change.use-case.js';

/**
 * Constant SESSION_ID
 *
 * @description
 * The session of the request, recently authenticated.
 *
 * @type {string}
 */
const SESSION_ID: string = '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60';

/**
 * Constant STALE_SESSION_ID
 *
 * @description
 * Another open session of Camille Martin, without a recent authentication.
 *
 * @type {string}
 */
const STALE_SESSION_ID: string = '019a6914-2f7a-7b3c-9d4e-5f6a7b8c9d01';

describe('RequestEmailChange', () => {
  let accounts: InMemoryAccounts;
  let clock: FixedClock;
  let sessions: FakeAccountSessions;
  let request: RequestEmailChange;
  let camille: User;
  let input: RequestEmailChangeInput;

  beforeEach(() => {
    accounts = new InMemoryAccounts();
    clock = new FixedClock('2026-11-09T13:20:00Z');
    sessions = new FakeAccountSessions(clock);
    request = new RequestEmailChange(accounts, new FakeCodeSecrets(['731406']), sessions, clock);
    camille = accounts.seedUser('camille.martin@ateliernord.fr', true, 'hashed:x');
    sessions.seed(SESSION_ID, camille.id, new Date('2026-11-09T13:15:00Z'));
    sessions.seed(STALE_SESSION_ID, camille.id, new Date('2026-11-09T13:05:00Z'));
    input = {
      actorUserId: camille.id,
      userId: camille.id,
      sessionId: SESSION_ID,
      email: ' Camille@AtelierNord.fr ',
    };
  });

  /**
   * The codes issued so far.
   *
   * @returns The codes.
   */
  function codeEvents(): RecordedEvent[] {
    return accounts.state.events.filter(
      (event: RecordedEvent) => event.name === 'one-time-code.issued.v1',
    );
  }

  it('issues a code of 15 minutes to the new address, for the change of this session', async () => {
    const sent: CodeSentView = await request.execute(input);

    expect(sent).toEqual({
      email: 'camille@ateliernord.fr',
      expiresAt: new Date('2026-11-09T13:35:00Z'),
      resendAvailableAt: new Date('2026-11-09T13:20:30Z'),
    });
    expect(accounts.state.emailChanges.get(camille.id)).toMatchObject({
      userId: camille.id,
      sessionId: SESSION_ID,
      email: { value: 'camille@ateliernord.fr' },
    });
    expect(accounts.state.users.get(camille.id)?.email.value).toBe('camille.martin@ateliernord.fr');
    expect(codeEvents()).toEqual([
      {
        name: 'one-time-code.issued.v1',
        issued: expect.objectContaining({
          purpose: 'email-change',
          code: '731406',
          recipient: expect.objectContaining({ value: 'camille@ateliernord.fr' }) as unknown,
          requestedByUser: true,
          expiresAt: new Date('2026-11-09T13:35:00Z'),
        }) as unknown,
      },
    ]);
    const code: OneTimeCodeState | undefined = accounts.state.codes.at(-1);
    expect(code).toMatchObject({ userId: camille.id, purpose: 'email-change' });
    expect(accounts.state.codeRequests.has('camille@ateliernord.fr')).toBe(true);
  });

  it('replaces the pending change and its code with a new request', async () => {
    await request.execute(input);
    clock.advance(30_000);
    await request.execute({ ...input, email: 'c.martin@ateliernord.fr' });

    expect(accounts.state.emailChanges.get(camille.id)?.email.value).toBe(
      'c.martin@ateliernord.fr',
    );
    expect(
      accounts.state.codes.filter(
        (code: OneTimeCodeState) => code.consumedAt === null && code.replacedAt === null,
      ),
    ).toHaveLength(1);
  });

  it('refuses the account of another person and a session that is not open', async () => {
    await expect(
      request.execute({ ...input, userId: '019a5f3c-8d2e-7c4a-9b1f-ffffffffffff' }),
    ).rejects.toMatchObject({ refusal: { reason: 'user-not-found' } });
    await expect(
      request.execute({ ...input, sessionId: '019a6a2e-4b1c-7d3e-8f5a-ffffffffffff' }),
    ).rejects.toMatchObject({ refusal: { reason: 'session-not-found' } });
  });

  it('requires a recent authentication of the session before anything else', async () => {
    await expect(
      request.execute({ ...input, sessionId: STALE_SESSION_ID, email: camille.email.value }),
    ).rejects.toMatchObject({ refusal: { reason: 'reauthentication-required' } });
    expect(accounts.state.emailChanges.size).toBe(0);
    expect(codeEvents()).toEqual([]);
  });

  it('refuses the current address', async () => {
    await expect(
      request.execute({ ...input, email: 'CAMILLE.MARTIN@ateliernord.fr' }),
    ).rejects.toMatchObject({ refusal: { reason: 'email-unchanged' } });
  });

  it('refuses an address a verified account uses, but not an unverified sign-up of it', async () => {
    accounts.seedUser('irene@ateliernord.fr', true, 'hashed:x');
    accounts.seedUser('pending@ateliernord.fr', false, 'hashed:x');

    await expect(
      request.execute({ ...input, email: 'irene@ateliernord.fr' }),
    ).rejects.toMatchObject({ refusal: { reason: 'email-taken' } });
    await expect(
      request.execute({ ...input, email: 'pending@ateliernord.fr' }),
    ).resolves.toMatchObject({ email: 'pending@ateliernord.fr' });
  });

  it('throttles the code requests of the new address with its other codes', async () => {
    await request.execute(input);
    clock.advance(10_000);

    await expect(request.execute(input)).rejects.toMatchObject({
      refusal: { reason: 'code-throttled', resendAvailableAt: new Date('2026-11-09T13:20:30Z') },
    });
    expect(codeEvents()).toHaveLength(1);
  });
});
