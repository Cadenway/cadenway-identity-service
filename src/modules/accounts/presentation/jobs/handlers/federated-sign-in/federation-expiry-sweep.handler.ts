import type { Job, JobScheduler, JobWorkerRegistry } from '@cadenway/nest-jobs/runtime';
import { Logger, type OnApplicationBootstrap } from '@nestjs/common';

import type { PurgeExpiredFederation } from '../../../../application/use-cases/commands/federated-sign-in/purge-expired-federation/purge-expired-federation.use-case.js';

/** Registers the durable system-only federation retention sweep. */
export class FederationExpirySweepHandler implements OnApplicationBootstrap {
  // #region Properties
  /** Reports deletion counts without logging provider or account data. */
  private readonly logger = new Logger(FederationExpirySweepHandler.name);
  // #endregion

  // #region Constructor
  /** Binds the provisioned queue, its schedule and the bounded retention use case. */
  public constructor(
    private readonly scheduler: JobScheduler,
    private readonly workers: JobWorkerRegistry,
    private readonly purge: PurgeExpiredFederation,
    private readonly queue: string,
    private readonly cron: string,
  ) {}
  // #endregion

  // #region Methods
  /** Upserts the same UTC schedule on every replica and registers its worker. */
  public async onApplicationBootstrap(): Promise<void> {
    await this.scheduler.schedule(this.queue, this.cron, { timeZone: 'UTC' });
    await this.workers.work(this.queue, (job: Job) => this.handle(job));
  }

  /** Retries failed batches through the queue and ignores rows already removed. */
  private async handle(job: Job): Promise<void> {
    if (job.organizationId !== null || job.payload !== null) {
      throw new Error('Federation expiry requires a system job without a payload.');
    }
    const result = await this.purge.execute(job.signal);
    if (result.flows + result.assertions > 0) {
      this.logger.log(result, 'expired federation rows removed');
    }
  }
  // #endregion
}
