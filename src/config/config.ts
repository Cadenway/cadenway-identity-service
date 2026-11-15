import { loadConfig } from '@cadenway/nest-common';

import { appConfigSchema } from './app-config.js';
import type { AppConfig } from './app-config.js';

/**
 * Constant config
 *
 * @description
 * Configuration of the running service, validated against `appConfigSchema` once, when this
 * module is first imported: a missing or invalid variable throws a `ConfigError` before the
 * application is created, so a misconfigured version never listens.
 *
 * Only the service process imports it (`main.ts`, `app.module.ts`). A unit test and the migrator
 * import the schemas of `app-config.ts` instead and validate the environment they are given.
 *
 * @type {Readonly<AppConfig>}
 */
export const config: Readonly<AppConfig> = loadConfig(appConfigSchema);
