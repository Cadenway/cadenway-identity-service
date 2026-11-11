import { Module } from '@nestjs/common';

import { HealthController } from './health/health.controller.js';

/**
 * Root module of the service.
 *
 * Business modules under `src/modules/` are registered here as they are created. The health
 * controller is a bootstrap placeholder until `@waypoint/nest-common` provides the health module.
 */
@Module({ controllers: [HealthController] })
export class AppModule {}
