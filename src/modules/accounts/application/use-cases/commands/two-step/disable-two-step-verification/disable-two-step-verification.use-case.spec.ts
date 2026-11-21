import { beforeEach, describe, expect, it } from 'vitest';

import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import {
  FakeAccountSessions,
  FakeDeviceReader,
  FixedClock,
  InMemoryAccounts,
} from '../../../../models/accounts/accounts.fixture.js';
import {
  FakeTrustedDevices,
  FakeTwoStepRequirements,
  FIREFOX,
  seedTwoStep,
} from '../../../../models/two-step/two-step.fixture.js';
import type { DisableTwoStepVerificationInput } from './disable-two-step-verification.input.js';
import { DisableTwoStepVerification } from './disable-two-step-verification.use-case.js';

/**
 * Constant SESSION_ID
 *
 * @description
 * The session of Camille Martin on Compte › Sécurité.
 *
 * @type {string}
 */
const SESSION_ID: string = '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60';

/**
 * Constant ATELIER_NORD_ID
 *
 * @description
 * Id of the organization Atelier Nord.
 *
 * @type {string}
 */
const ATELIER_NORD_ID: string = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b20';

describe('DisableTwoStepVerification', () => {
  let accounts: InMemoryAccounts;
  let sessions: FakeAccountSessions;
  let requirements: FakeTwoStepRequirements;
  let trustedDevices: FakeTrustedDevices;
  let disable: DisableTwoStepVerification;
  let camille: User;
  let input: DisableTwoStepVerificationInput;

  beforeEach(() => {
    accounts = new InMemoryAccounts();
    const clock: FixedClock = new FixedClock('2026-11-09T13:20:00Z');
    sessions = new FakeAccountSessions(clock);
    requirements = new FakeTwoStepRequirements();
    trustedDevices = new FakeTrustedDevices();
    disable = new DisableTwoStepVerification(
      accounts,
      sessions,
      requirements,
      sessions,
      trustedDevices,
      new FakeDeviceReader(),
    );
    camille = accounts.seedUser('camille.martin@ateliernord.fr', true, 'hashed:x');
    seedTwoStep(accounts, camille.id, new Date('2026-03-03T10:15:00Z'));
    sessions.enrolled.add(camille.id);
    sessions.seed(SESSION_ID, camille.id, new Date('2026-11-09T13:15:00Z'), 'two-step');
    input = { actorUserId: camille.id, userId: camille.id, sessionId: SESSION_ID, client: FIREFOX };
  });

  it('deletes the app, the keys and the codes, forgets the devices and emits the change', async () => {
    accounts.state.challenges.set(camille.id, {
      id: '019a6c52-1d2e-7f3a-8b4c-5d6e7f8a9b10',
      userId: camille.id,
      tokenHash: 'hash:challenge-1',
      persistent: false,
      expiresAt: new Date('2026-11-09T13:25:00Z'),
      federatedBinding: null,
      assertionChallenge: null,
      assertionExpiresAt: null,
    });
    await trustedDevices.trust(camille.id);

    await disable.execute(input);

    expect(accounts.state.twoStep.has(camille.id)).toBe(false);
    expect(accounts.state.backupCodes).toEqual([]);
    expect(accounts.state.challenges.has(camille.id)).toBe(false);
    expect(trustedDevices.forgotten).toEqual([camille.id]);
    expect(sessions.enrolled.has(camille.id)).toBe(false);
    expect(accounts.state.users.get(camille.id)?.version).toBe(camille.version + 1);
    expect(accounts.state.events.at(-1)).toMatchObject({
      name: 'user.two-step-verification-changed.v1',
      summary: { change: 'disabled', enabled: false, methods: [], backupCodesRemaining: 0 },
      client: { ipAddress: FIREFOX.ipAddress },
    });
  });

  it('refuses while a policy of an organization requires it, before the recent authentication', async () => {
    requirements.required.set(camille.id, [
      { organizationId: ATELIER_NORD_ID, requiredFor: 'admins' },
    ]);
    sessions.seed(SESSION_ID, camille.id, null);

    await expect(disable.execute(input)).rejects.toMatchObject({
      refusal: { reason: 'mfa-required-by-organization', organizationIds: [ATELIER_NORD_ID] },
    });
    expect(accounts.state.twoStep.has(camille.id)).toBe(true);
  });

  it('requires a recent proof by a second factor, a password window not counting', async () => {
    sessions.seed(SESSION_ID, camille.id, new Date('2026-11-09T13:15:00Z'), 'password');

    await expect(disable.execute(input)).rejects.toMatchObject({
      refusal: { reason: 'reauthentication-required', methods: ['authenticator-app'] },
    });
    expect(accounts.state.events).toEqual([]);
  });

  it('answers without a change for an account already without two-step verification', async () => {
    await disable.execute(input);
    const events: number = accounts.state.events.length;

    await disable.execute(input);

    expect(accounts.state.events).toHaveLength(events);
    expect(trustedDevices.forgotten).toHaveLength(1);
  });
});
