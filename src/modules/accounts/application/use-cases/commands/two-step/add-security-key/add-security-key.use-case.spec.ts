import { beforeEach, describe, expect, it } from 'vitest';

import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import {
  FakeAccountSessions,
  FakeDeviceReader,
  FixedClock,
  InMemoryAccounts,
} from '../../../../models/accounts/accounts.fixture.js';
import {
  FakeWebAuthn,
  FIREFOX,
  seedTwoStep,
} from '../../../../models/two-step/two-step.fixture.js';
import type { SecurityKeyView } from '../../../../projections/two-step/security-key-view.projection.js';
import type { WebAuthnOptionsView } from '../../../../projections/two-step/web-authn-options-view.projection.js';
import { RemoveSecurityKey } from '../remove-security-key/remove-security-key.use-case.js';
import { StartSecurityKeyRegistration } from '../start-security-key-registration/start-security-key-registration.use-case.js';
import { AddSecurityKey } from './add-security-key.use-case.js';

/**
 * Constant SESSION_ID
 *
 * @description
 * The session of Camille Martin on Compte › Sécurité.
 *
 * @type {string}
 */
const SESSION_ID: string = '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60';

describe('AddSecurityKey', () => {
  let accounts: InMemoryAccounts;
  let clock: FixedClock;
  let sessions: FakeAccountSessions;
  let start: StartSecurityKeyRegistration;
  let add: AddSecurityKey;
  let remove: RemoveSecurityKey;
  let camille: User;

  /**
   * Function register
   *
   * @description
   * Starts a registration in the session of the spec and answers it with a credential.
   *
   * @param {string} credentialId - The id of the credential.
   * @param {string} name - The name of the key, as typed.
   * @returns {Promise<SecurityKeyView>} The new key.
   */
  async function register(credentialId: string, name: string): Promise<SecurityKeyView> {
    const options: WebAuthnOptionsView = await start.execute({
      actorUserId: camille.id,
      userId: camille.id,
      sessionId: SESSION_ID,
    });
    return add.execute({
      actorUserId: camille.id,
      userId: camille.id,
      sessionId: SESSION_ID,
      name,
      credential: { id: credentialId, challenge: options.options.challenge },
      client: FIREFOX,
    });
  }

  beforeEach(() => {
    accounts = new InMemoryAccounts();
    clock = new FixedClock('2026-11-09T13:20:00Z');
    sessions = new FakeAccountSessions(clock);
    const webAuthn: FakeWebAuthn = new FakeWebAuthn();
    start = new StartSecurityKeyRegistration(accounts, sessions, webAuthn, clock);
    add = new AddSecurityKey(accounts, sessions, webAuthn, new FakeDeviceReader(), clock);
    remove = new RemoveSecurityKey(accounts, sessions, new FakeDeviceReader());
    camille = accounts.seedUser('camille.martin@ateliernord.fr', true, 'hashed:x');
    sessions.enrolled.add(camille.id);
    sessions.seed(SESSION_ID, camille.id, new Date('2026-11-09T13:15:00Z'), 'two-step');
  });

  it('refuses a registration without two-step verification', async () => {
    await expect(
      start.execute({ actorUserId: camille.id, userId: camille.id, sessionId: SESSION_ID }),
    ).rejects.toMatchObject({ refusal: { reason: 'two-step-not-enabled' } });
  });

  it('registers a key under its trimmed name and emits the change', async () => {
    seedTwoStep(accounts, camille.id, new Date('2026-03-03T10:15:00Z'));

    const key: SecurityKeyView = await register('credential-yubikey', '  YubiKey 5C NFC  ');

    expect(key).toMatchObject({ name: 'YubiKey 5C NFC', lastUsedAt: null });
    expect(accounts.state.registrations.has(camille.id)).toBe(false);
    expect(accounts.state.events.at(-1)).toMatchObject({
      name: 'user.two-step-verification-changed.v1',
      summary: {
        change: 'security-key-added',
        methods: ['authenticator-app', 'security-key'],
        securityKey: { id: key.id, name: 'YubiKey 5C NFC' },
      },
    });
  });

  it('refuses an answer to other options, and a credential another account has', async () => {
    seedTwoStep(accounts, camille.id, new Date('2026-03-03T10:15:00Z'));
    await start.execute({ actorUserId: camille.id, userId: camille.id, sessionId: SESSION_ID });

    await expect(
      add.execute({
        actorUserId: camille.id,
        userId: camille.id,
        sessionId: SESSION_ID,
        name: 'YubiKey 5C NFC',
        credential: { id: 'credential-yubikey', challenge: 'another-challenge' },
        client: FIREFOX,
      }),
    ).rejects.toMatchObject({
      refusal: { reason: 'security-key-refused', remainingAttempts: null },
    });
    accounts.state.securityKeys.push({
      id: '019a6c52-1d2e-7f3a-8b4c-5d6e7f8a9b09',
      userId: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b31',
      name: 'Clé de Léa',
      credentialId: 'credential-of-lea',
      publicKey: 'public-key',
      counter: 3,
      transports: [],
      createdAt: new Date('2026-10-01T09:00:00Z'),
      lastUsedAt: null,
    });
    await expect(register('credential-of-lea', 'YubiKey 5C NFC')).rejects.toMatchObject({
      refusal: { reason: 'security-key-refused' },
    });
  });

  it('refuses an eleventh key', async () => {
    seedTwoStep(accounts, camille.id, new Date('2026-03-03T10:15:00Z'));
    for (let index: number = 0; index < 10; index += 1) {
      await register(`credential-${String(index)}`, `Clé ${String(index)}`);
    }

    await expect(
      start.execute({ actorUserId: camille.id, userId: camille.id, sessionId: SESSION_ID }),
    ).rejects.toMatchObject({
      refusal: { reason: 'security-key-limit-reached', maxSecurityKeys: 10 },
    });
  });

  it('removes a key of the account only', async () => {
    seedTwoStep(accounts, camille.id, new Date('2026-03-03T10:15:00Z'));
    const key: SecurityKeyView = await register('credential-yubikey', 'YubiKey 5C NFC');

    await expect(
      remove.execute({
        actorUserId: camille.id,
        userId: camille.id,
        sessionId: SESSION_ID,
        securityKeyId: '019a6c52-1d2e-7f3a-8b4c-5d6e7f8a9b09',
        client: FIREFOX,
      }),
    ).rejects.toMatchObject({ refusal: { reason: 'security-key-not-found' } });
    await remove.execute({
      actorUserId: camille.id,
      userId: camille.id,
      sessionId: SESSION_ID,
      securityKeyId: key.id,
      client: FIREFOX,
    });

    expect(accounts.state.securityKeys).toEqual([]);
    expect(accounts.state.events.at(-1)).toMatchObject({
      summary: { change: 'security-key-removed', methods: ['authenticator-app'] },
    });
  });
});
