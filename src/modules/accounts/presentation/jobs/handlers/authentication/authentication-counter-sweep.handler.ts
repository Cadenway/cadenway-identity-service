import type { Job, JobScheduler, JobWorkerRegistry } from '@cadenway/nest-jobs/runtime';
import { Logger, type OnApplicationBootstrap } from '@nestjs/common';

import type { PurgeInactiveAuthenticationCounters } from '../../../../application/use-cases/commands/authentication/purge-inactive-authentication-counters/purge-inactive-authentication-counters.use-case.js';

/** Registers the durable sweep for inactive address counters. */
export class AuthenticationCounterSweepHandler implements OnApplicationBootstrap {
  // #region Properties
  /** Logs retention counts without storing account data in the logs. */
  private readonly logger = new Logger(AuthenticationCounterSweepHandler.name);
  // #endregion

  // #region Constructor
  /** Binds the provisioned queue, schedule and retention use case. */
  public constructor(
    private readonly scheduler: JobScheduler,
    private readonly workers: JobWorkerRegistry,
    private readonly purge: PurgeInactiveAuthenticationCounters,
    private readonly queue: string,
    private readonly cron: string,
    private readonly enabled: boolean,
  ) {}
  // #endregion

  // #region Methods
  /** Upserts the same UTC schedule and registers its worker on each replica. */
  public async onApplicationBootstrap(): Promise<void> {
    if (!this.enabled) {
      await this.scheduler.unschedule(this.queue);
      return;
    }
    await this.scheduler.schedule(this.queue, this.cron, { timeZone: 'UTC' });
    await this.workers.work(this.queue, (job: Job) => this.handle(job));
  }

  /** Runs only trusted system jobs that carry no personal data. */
  private async handle(job: Job): Promise<void> {
    if (job.organizationId !== null || job.payload !== null) {
      throw new Error('Authentication counter retention requires a system job without a payload.');
    }
    const deleted = await this.purge.execute(job.signal);
    if (deleted > 0) {
      this.logger.log({ deleted }, 'inactive authentication counters removed');
    }
  }
  // #endregion
}
