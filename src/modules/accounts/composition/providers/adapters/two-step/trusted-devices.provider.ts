import type { FactoryProvider } from '@nestjs/common';

import { CheckTrustedDevice } from '../../../../../sessions/public/trusted-device/check-trusted-device.js';
import type { CheckTrustedDeviceOutput } from '../../../../../sessions/public/trusted-device/check-trusted-device.js';
import { ForgetTrustedDevices } from '../../../../../sessions/public/trusted-device/forget-trusted-devices.js';
import { TrustDevice } from '../../../../../sessions/public/trusted-device/trust-device.js';
import type { TrustDeviceOutput } from '../../../../../sessions/public/trusted-device/trust-device.js';
import type { TrustedDeviceGrant } from '../../../../application/models/sessions/trusted-device-grant.model.js';
import type { TrustedDevices } from '../../../../application/ports/outbound/identity/sessions/trusted-devices.port.js';
import { TRUSTED_DEVICES } from '../../../tokens/two-step/trusted-devices.token.js';

/**
 * Constant trustedDevicesProvider
 *
 * @description
 * Binds `TrustedDevices` to the public trusted-device operations of the sessions module, which
 * join the system transaction of the accounts module.
 *
 * @type {FactoryProvider<TrustedDevices>}
 */
export const trustedDevicesProvider: FactoryProvider<TrustedDevices> = {
  provide: TRUSTED_DEVICES,
  inject: [TrustDevice, CheckTrustedDevice, ForgetTrustedDevices],
  useFactory: (
    trustDevice: TrustDevice,
    checkTrustedDevice: CheckTrustedDevice,
    forgetTrustedDevices: ForgetTrustedDevices,
  ): TrustedDevices => ({
    trust: async (userId: string): Promise<TrustedDeviceGrant> => {
      const trusted: TrustDeviceOutput = await trustDevice.execute({ userId });
      return { token: trusted.token, expiresAt: trusted.expiresAt };
    },
    isTrusted: async (userId: string, token: string): Promise<boolean> => {
      const checked: CheckTrustedDeviceOutput = await checkTrustedDevice.execute({ userId, token });
      return checked.trusted;
    },
    forget: (userId: string): Promise<void> => forgetTrustedDevices.execute({ userId }),
  }),
};
