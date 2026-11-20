import type { Job, JobScheduler, JobWorkerRegistry } from '@cadenway/nest-jobs/runtime';
import type { OnApplicationBootstrap } from '@nestjs/common';

import type { AbandonAvatarUploadInput } from '../../../../application/use-cases/commands/avatar/abandon-avatar-upload/abandon-avatar-upload.input.js';
import type { AbandonAvatarUpload } from '../../../../application/use-cases/commands/avatar/abandon-avatar-upload/abandon-avatar-upload.use-case.js';

const batchSize = 100;

/** Schedules bounded owner-side retirement of expired upload reservations. */
export class AvatarUploadExpiryHandler implements OnApplicationBootstrap {
  // #region Constructor
  /** Takes the schedules, worker registry and owner-side retirement operation. */
  public constructor(
    private readonly scheduler: JobScheduler,
    private readonly workers: JobWorkerRegistry,
    private readonly findExpired: (limit: number) => Promise<readonly AbandonAvatarUploadInput[]>,
    private readonly abandon: AbandonAvatarUpload,
    private readonly queue: string,
    private readonly cron: string,
  ) {}
  // #endregion

  // #region Methods
  /** Schedules a single durable UTC occurrence across Identity replicas. */
  public async onApplicationBootstrap(): Promise<void> {
    await this.scheduler.schedule(this.queue, this.cron, { timeZone: 'UTC' });
    await this.workers.work(this.queue, (job: Job): Promise<void> => this.handle(job));
  }

  /** Rechecks each candidate under its account lock, in an independent transaction. */
  private async handle(job: Job): Promise<void> {
    if (job.organizationId !== null || job.payload !== null) {
      throw new Error('Avatar expiry requires a system job without a payload.');
    }
    job.signal.throwIfAborted();
    const candidates = await this.findExpired(batchSize);
    for (const candidate of candidates) {
      job.signal.throwIfAborted();
      await this.abandon.execute(candidate);
    }
  }
  // #endregion
}
