import type { FactoryProvider } from '@nestjs/common';
import { BowserDeviceReader } from '../../../../infrastructure/adapters/bowser/bowser-device-reader.adapter.js';
import type { DeviceReader } from '../../../../application/ports/outbound/device/session/device-reader.port.js';
import { DEVICE_READER } from '../../../tokens/session/device-reader.token.js';

/**
 * Constant deviceReaderProvider
 *
 * @description
 * Keeps user-agent parsing behind the sessions device reader port.
 *
 * @type {FactoryProvider<DeviceReader>}
 */
export const deviceReaderProvider: FactoryProvider<DeviceReader> = {
  provide: DEVICE_READER,
  useFactory: (): DeviceReader => new BowserDeviceReader(),
};
