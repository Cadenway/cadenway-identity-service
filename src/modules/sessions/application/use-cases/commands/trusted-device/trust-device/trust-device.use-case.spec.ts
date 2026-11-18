import { beforeEach, describe, expect, it } from 'vitest';

import { CheckTrustedDevice } from '../../../queries/trusted-device/check-trusted-device/check-trusted-device.use-case.js';
import { FakeSessionTokens, FixedClock, InMemorySessions } from '../../session/sessions.fixture.js';
import { ForgetTrustedDevices } from '../forget-trusted-devices/forget-trusted-devices.use-case.js';
import type { TrustDeviceOutput } from './trust-device.output.js';
import { TrustDevice } from './trust-device.use-case.js';

const CAMILLE_ID: string = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';
const LEA_ID: string = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b31';
const DAY: number = 24 * 60 * 60_000;

describe('TrustDevice, CheckTrustedDevice and ForgetTrustedDevices', () => {
  let store: InMemorySessions;
  let clock: FixedClock;
  let trust: TrustDevice;
  let check: CheckTrustedDevice;

  beforeEach(() => {
    store = new InMemorySessions();
    clock = new FixedClock('2026-11-09T07:42:00Z');
    const tokens: FakeSessionTokens = new FakeSessionTokens();
    trust = new TrustDevice(store, tokens, clock);
    check = new CheckTrustedDevice(store, tokens, clock);
  });

  it('trusts the browser of the account for 30 days, keeping only the hash of its token', async () => {
    const device: TrustDeviceOutput = await trust.execute({ userId: CAMILLE_ID });

    expect(device.expiresAt).toEqual(new Date('2026-12-09T07:42:00Z'));
    expect([...store.trustedDevices.keys()]).toEqual([`hash:${device.token}`]);
    await expect(check.execute({ userId: CAMILLE_ID, token: device.token })).resolves.toEqual({
      trusted: true,
    });
    clock.advance(30 * DAY);
    await expect(check.execute({ userId: CAMILLE_ID, token: device.token })).resolves.toEqual({
      trusted: false,
    });
  });

  it('ignores a token of another account, an unknown one and a malformed one', async () => {
    const device: TrustDeviceOutput = await trust.execute({ userId: CAMILLE_ID });

    for (const [userId, token] of [
      [LEA_ID, device.token],
      [CAMILLE_ID, 'U'.repeat(43)],
      [CAMILLE_ID, 'short'],
    ] as const) {
      await expect(check.execute({ userId, token })).resolves.toEqual({ trusted: false });
    }
  });

  it('forgets every trusted device of the account only', async () => {
    const camille: TrustDeviceOutput = await trust.execute({ userId: CAMILLE_ID });
    await trust.execute({ userId: CAMILLE_ID });
    const lea: TrustDeviceOutput = await trust.execute({ userId: LEA_ID });

    await new ForgetTrustedDevices(store).execute({ userId: CAMILLE_ID });

    await expect(check.execute({ userId: CAMILLE_ID, token: camille.token })).resolves.toEqual({
      trusted: false,
    });
    await expect(check.execute({ userId: LEA_ID, token: lea.token })).resolves.toEqual({
      trusted: true,
    });
  });

  it('deletes the expired devices of the account when it trusts a new one', async () => {
    await trust.execute({ userId: CAMILLE_ID });
    clock.advance(31 * DAY);
    await trust.execute({ userId: CAMILLE_ID });

    expect(store.trustedDevices.size).toBe(1);
  });

  it('keeps the 10 devices trusted last, forgetting the one trusted first', async () => {
    const first: TrustDeviceOutput = await trust.execute({ userId: CAMILLE_ID });
    for (let device: number = 1; device <= 10; device += 1) {
      clock.advance(60_000);
      await trust.execute({ userId: CAMILLE_ID });
    }

    expect(store.trustedDevices.size).toBe(10);
    await expect(check.execute({ userId: CAMILLE_ID, token: first.token })).resolves.toEqual({
      trusted: false,
    });
  });
});
