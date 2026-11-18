import { beforeEach, describe, expect, it } from 'vitest';

import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import { EmailAddress } from '../../../../../domain/value-objects/email/email-address.value-object.js';
import {
  FakeAccountApiTokens,
  FakeAccountSessions,
  FakeOwnedOrganizations,
  FixedClock,
  InMemoryAccounts,
} from '../../../../models/accounts/accounts.fixture.js';
import { FakeTrustedDevices } from '../../../../models/two-step/two-step.fixture.js';
import type { ScheduleAccountDeletionInput } from './schedule-account-deletion.input.js';
import { ScheduleAccountDeletion } from './schedule-account-deletion.use-case.js';

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

/**
 * Constant ATELIER_NORD
 *
 * @description
 * The organization Camille Martin owns in some specs.
 *
 * @type {string}
 */
const ATELIER_NORD: string = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';

describe('ScheduleAccountDeletion', () => {
  let accounts: InMemoryAccounts;
  let clock: FixedClock;
  let sessions: FakeAccountSessions;
  let apiTokens: FakeAccountApiTokens;
  let owned: FakeOwnedOrganizations;
  let trustedDevices: FakeTrustedDevices;
  let schedule: ScheduleAccountDeletion;
  let camille: User;
  let input: ScheduleAccountDeletionInput;

  beforeEach(() => {
    accounts = new InMemoryAccounts();
    clock = new FixedClock('2026-11-09T15:30:00Z');
    sessions = new FakeAccountSessions(clock);
    apiTokens = new FakeAccountApiTokens();
    owned = new FakeOwnedOrganizations();
    trustedDevices = new FakeTrustedDevices();
    schedule = new ScheduleAccountDeletion(
      accounts,
      sessions,
      apiTokens,
      owned,
      clock,
      trustedDevices,
    );
    camille = accounts.seedUser('camille.martin@ateliernord.fr', true, 'hashed:x');
    sessions.seed(SESSION_ID, camille.id, new Date('2026-11-09T15:25:00Z'));
    sessions.seed(STALE_SESSION_ID, camille.id, null);
    apiTokens.unrevoked.set(camille.id, 3);
    input = { actorUserId: camille.id, userId: camille.id, sessionId: SESSION_ID };
  });

  it('schedules the deletion in 30 days and revokes every session and token at once', async () => {
    accounts.state.emailChanges.set(camille.id, {
      userId: camille.id,
      sessionId: SESSION_ID,
      email: EmailAddress.of('camille@ateliernord.fr'),
    });

    await expect(schedule.execute(input)).resolves.toEqual({
      deleteAt: new Date('2026-12-09T15:30:00Z'),
    });

    const user: User | undefined = accounts.state.users.get(camille.id);
    expect(user?.deleteAt).toEqual(new Date('2026-12-09T15:30:00Z'));
    expect(user?.version).toBe(camille.version + 1);
    await expect(sessions.countOpen(camille.id)).resolves.toBe(0);
    expect(apiTokens.unrevoked.get(camille.id)).toBe(0);
    expect(accounts.state.emailChanges.has(camille.id)).toBe(false);
    expect(accounts.state.events.at(-1)).toMatchObject({
      name: 'user.deletion-scheduled.v1',
      user: { deleteAt: new Date('2026-12-09T15:30:00Z') },
    });
  });

  it('refuses the owner of an organization before asking for a recent authentication', async () => {
    owned.owned.set(camille.id, [ATELIER_NORD]);

    await expect(schedule.execute({ ...input, sessionId: STALE_SESSION_ID })).rejects.toMatchObject(
      { refusal: { reason: 'organization-owner', organizationIds: [ATELIER_NORD] } },
    );
    expect(accounts.state.users.get(camille.id)?.deleteAt).toBeNull();
    await expect(sessions.countOpen(camille.id)).resolves.toBe(2);
    expect(apiTokens.unrevoked.get(camille.id)).toBe(3);
  });

  it('requires a recent authentication of the session', async () => {
    await expect(schedule.execute({ ...input, sessionId: STALE_SESSION_ID })).rejects.toMatchObject(
      { refusal: { reason: 'reauthentication-required' } },
    );
    expect(accounts.state.events).toEqual([]);
  });

  it('refuses the account of another person and a session that is not open, first', async () => {
    owned.owned.set(camille.id, [ATELIER_NORD]);

    await expect(
      schedule.execute({ ...input, userId: '019a5f3c-8d2e-7c4a-9b1f-ffffffffffff' }),
    ).rejects.toMatchObject({ refusal: { reason: 'user-not-found' } });
    await expect(
      schedule.execute({ ...input, sessionId: '019a6a2e-4b1c-7d3e-8f5a-ffffffffffff' }),
    ).rejects.toMatchObject({ refusal: { reason: 'session-not-found' } });
  });
});
