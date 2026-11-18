import { beforeEach, describe, expect, it } from 'vitest';

import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import {
  FakeAccountSessions,
  FakeDeviceReader,
  FixedClock,
  InMemoryAccounts,
} from '../../../../models/accounts/accounts.fixture.js';
import {
  FakeAuthenticatorAppSecrets,
  FakeBackupCodeSecrets,
  FakeTotp,
  FakeTwoStepRequirements,
  FakeWebAuthn,
  FIREFOX,
} from '../../../../models/two-step/two-step.fixture.js';
import type { AuthenticatorAppConfiguredView } from '../../../../projections/two-step/authenticator-app-configured-view.projection.js';
import type { AuthenticatorAppSetupView } from '../../../../projections/two-step/authenticator-app-setup-view.projection.js';
import { StartAuthenticatorAppSetup } from '../start-authenticator-app-setup/start-authenticator-app-setup.use-case.js';
import { ConfirmAuthenticatorAppSetup } from './confirm-authenticator-app-setup.use-case.js';

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
 * Constant OTHER_SESSION_ID
 *
 * @description
 * Another session of Camille Martin, on her phone.
 *
 * @type {string}
 */
const OTHER_SESSION_ID: string = '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a61';

describe('ConfirmAuthenticatorAppSetup', () => {
  let accounts: InMemoryAccounts;
  let clock: FixedClock;
  let sessions: FakeAccountSessions;
  let start: StartAuthenticatorAppSetup;
  let confirm: ConfirmAuthenticatorAppSetup;
  let camille: User;

  /**
   * Function startSetup
   *
   * @description
   * Starts a setup in the session of the spec and returns the code its app shows now.
   *
   * @returns {Promise<{ readonly setup: AuthenticatorAppSetupView; readonly code: string }>} The setup and its code.
   */
  async function startSetup(): Promise<{
    readonly setup: AuthenticatorAppSetupView;
    readonly code: string;
  }> {
    const setup: AuthenticatorAppSetupView = await start.execute({
      actorUserId: camille.id,
      userId: camille.id,
      sessionId: SESSION_ID,
    });
    return { setup, code: FakeTotp.codeOf(setup.secret, FakeTotp.stepAt(clock.now())) };
  }

  beforeEach(() => {
    accounts = new InMemoryAccounts();
    clock = new FixedClock('2026-11-09T13:20:00Z');
    sessions = new FakeAccountSessions(clock);
    const appSecrets: FakeAuthenticatorAppSecrets = new FakeAuthenticatorAppSecrets();
    const totp: FakeTotp = new FakeTotp();
    start = new StartAuthenticatorAppSetup(accounts, sessions, appSecrets, totp, clock);
    confirm = new ConfirmAuthenticatorAppSetup(
      accounts,
      sessions,
      appSecrets,
      totp,
      new FakeBackupCodeSecrets(),
      new FakeWebAuthn(),
      sessions,
      new FakeTwoStepRequirements(),
      new FakeDeviceReader(),
      clock,
    );
    camille = accounts.seedUser('camille.martin@ateliernord.fr', true, 'hashed:x');
    sessions.seed(SESSION_ID, camille.id, new Date('2026-11-09T13:15:00Z'));
    sessions.seed(OTHER_SESSION_ID, camille.id, new Date('2026-11-09T13:16:00Z'));
  });

  it('requires a recent authentication of the session to start a setup', async () => {
    sessions.seed(SESSION_ID, camille.id, null);

    await expect(
      start.execute({ actorUserId: camille.id, userId: camille.id, sessionId: SESSION_ID }),
    ).rejects.toMatchObject({
      refusal: { reason: 'reauthentication-required', methods: ['password'] },
    });
    expect(accounts.state.setups.size).toBe(0);
  });

  it('keeps the sealed secret of a started setup for 15 minutes, for its session', async () => {
    const { setup } = await startSetup();

    expect(setup.expiresAt).toEqual(new Date('2026-11-09T13:35:00Z'));
    expect(setup.otpauthUri).toContain('camille.martin@ateliernord.fr');
    expect(accounts.state.setups.get(camille.id)).toEqual({
      sessionId: SESSION_ID,
      value: `sealed:${camille.id}:${setup.secret}`,
      expiresAt: new Date('2026-11-09T13:35:00Z'),
    });
  });

  it('turns two-step verification on with 10 backup codes, once, and emits the change', async () => {
    const { code } = await startSetup();

    const configured: AuthenticatorAppConfiguredView = await confirm.execute({
      actorUserId: camille.id,
      userId: camille.id,
      sessionId: SESSION_ID,
      code,
      client: FIREFOX,
    });

    expect(configured.backupCodes?.codes).toHaveLength(10);
    expect(configured.twoStepVerification).toMatchObject({
      configuredAt: new Date('2026-11-09T13:20:00Z'),
      backupCodes: { remaining: 10, total: 10 },
    });
    expect(accounts.state.twoStep.get(camille.id)?.lastAcceptedTimeStep).toBe(
      FakeTotp.stepAt(clock.now()),
    );
    expect(
      accounts.state.backupCodes.map((stored: { readonly codeHash: string }) => stored.codeHash),
    ).not.toContain(configured.backupCodes?.codes[0]);
    expect(accounts.state.backupCodes).toHaveLength(10);
    expect(accounts.state.setups.has(camille.id)).toBe(false);
    expect(sessions.enrolled.has(camille.id)).toBe(true);
    expect(sessions.sessions.get(SESSION_ID)).toMatchObject({ method: 'two-step' });
    await expect(sessions.check(camille.id, SESSION_ID)).resolves.toBe('recent');
    await expect(sessions.check(camille.id, OTHER_SESSION_ID)).resolves.toBe('stale');
    expect(accounts.state.users.get(camille.id)?.version).toBe(camille.version + 1);
    expect(accounts.state.events.at(-1)).toMatchObject({
      name: 'user.two-step-verification-changed.v1',
      summary: {
        change: 'enabled',
        enabled: true,
        methods: ['authenticator-app'],
        backupCodesRemaining: 10,
        securityKey: null,
      },
    });
  });

  it('refuses a wrong code without counting it, and keeps the setup', async () => {
    await startSetup();

    await expect(
      confirm.execute({
        actorUserId: camille.id,
        userId: camille.id,
        sessionId: SESSION_ID,
        code: '000000',
        client: FIREFOX,
      }),
    ).rejects.toMatchObject({
      refusal: { reason: 'two-step-code-invalid', remainingAttempts: null },
    });
    expect(accounts.state.setups.has(camille.id)).toBe(true);
    expect(accounts.state.twoStep.has(camille.id)).toBe(false);
  });

  it('refuses the setup of another session, and an expired one', async () => {
    const { code } = await startSetup();

    await expect(
      confirm.execute({
        actorUserId: camille.id,
        userId: camille.id,
        sessionId: OTHER_SESSION_ID,
        code,
        client: FIREFOX,
      }),
    ).rejects.toMatchObject({ refusal: { reason: 'two-step-setup-expired' } });
    clock.advance(15 * 60_000);
    await expect(
      confirm.execute({
        actorUserId: camille.id,
        userId: camille.id,
        sessionId: SESSION_ID,
        code,
        client: FIREFOX,
      }),
    ).rejects.toMatchObject({ refusal: { reason: 'two-step-setup-expired' } });
  });

  it('replaces the app of an account with two-step verification, keeping its backup codes', async () => {
    const first: { readonly code: string } = await startSetup();
    await confirm.execute({
      actorUserId: camille.id,
      userId: camille.id,
      sessionId: SESSION_ID,
      code: first.code,
      client: FIREFOX,
    });
    const handle: string | undefined = accounts.state.twoStep.get(camille.id)?.webauthnUserHandle;
    clock.advance(60_000);

    const second: { readonly setup: AuthenticatorAppSetupView; readonly code: string } =
      await startSetup();
    const replaced: AuthenticatorAppConfiguredView = await confirm.execute({
      actorUserId: camille.id,
      userId: camille.id,
      sessionId: SESSION_ID,
      code: second.code,
      client: FIREFOX,
    });

    expect(replaced.backupCodes).toBeNull();
    expect(accounts.state.twoStep.get(camille.id)).toMatchObject({
      sealedSecret: `sealed:${camille.id}:${second.setup.secret}`,
      webauthnUserHandle: handle,
    });
    expect(accounts.state.backupCodes).toHaveLength(10);
    expect(accounts.state.events.at(-1)).toMatchObject({
      summary: { change: 'authenticator-app-replaced', enabled: true },
    });
  });

  it('refuses the account of another person first', async () => {
    await expect(
      confirm.execute({
        actorUserId: camille.id,
        userId: '019a5f3c-8d2e-7c4a-9b1f-ffffffffffff',
        sessionId: SESSION_ID,
        code: '000000',
        client: FIREFOX,
      }),
    ).rejects.toMatchObject({ refusal: { reason: 'user-not-found' } });
  });
});
