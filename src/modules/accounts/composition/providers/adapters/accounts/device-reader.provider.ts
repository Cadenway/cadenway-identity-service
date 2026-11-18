import type { FactoryProvider } from '@nestjs/common';

import { BowserDeviceReader } from '../../../../../../infrastructure/bowser-device-reader.js';
import type { DeviceReader } from '../../../../application/ports/outbound/device/accounts/device-reader.port.js';
import { DEVICE_READER } from '../../../tokens/accounts/device-reader.token.js';

/**
 * Constant deviceReaderProvider
 *
 * @description
 * Binds the device reader port of the accounts module to the `bowser` reader shared by the modules
 * that read a `User-Agent`, for the rows "Appareil" of the security e-mails.
 *
 * @type {FactoryProvider<DeviceReader>}
 */
export const deviceReaderProvider: FactoryProvider<DeviceReader> = {
  provide: DEVICE_READER,
  useFactory: (): DeviceReader => new BowserDeviceReader(),
};
