import { SystemTransactionRunner, TenantTransactionRunner } from '@cadenway/nest-common/database';
import { EventConsumers } from '@cadenway/nest-messaging';
import type { EventRedelivery } from '@cadenway/nest-messaging';
import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MembershipsModule } from '../../../../memberships.module.js';
import { MEMBER_EVENTS_REDELIVERY } from '../../../tokens/membership/member-events-redelivery.token.js';

/** The schedule decision 3 of the P2b security follow-ups fixes for the three consumers. */
const productionSchedule: EventRedelivery = {
  delaysMs: [1_000, 5_000, 30_000, 120_000, 600_000, 1_800_000, 3_600_000],
  maxDeliveries: 32,
};

/** One day, the least a security projection keeps retrying before its dead letter. */
const oneDayMs = 24 * 60 * 60 * 1_000;

/**
 * Adds up the delays a failing message waits before its dead letter: one delay after each failed
 * delivery but the last, the last delay repeating, as the kit applies them.
 *
 * @param schedule - The redelivery schedule.
 * @returns The wait in milliseconds.
 */
function waitBeforeDeadLetter(schedule: EventRedelivery): number {
  const deliveries = schedule.maxDeliveries ?? schedule.delaysMs.length + 1;
  let total = 0;
  for (let failure = 0; failure < deliveries - 1; failure += 1) {
    total += schedule.delaysMs[Math.min(failure, schedule.delaysMs.length - 1)] ?? 0;
  }
  return total;
}

/** The registrations `MembershipsModule` made, in order. */
const subscribe = vi.fn<(registration: unknown) => Promise<void>>();

/**
 * Stands for the global providers of the kit that `MembershipsModule` injects: the durable
 * consumers, which record the registrations instead of reaching a broker, and the two runners,
 * which no registration uses.
 */
@Global()
@Module({
  providers: [
    { provide: EventConsumers, useValue: { subscribe } },
    { provide: TenantTransactionRunner, useValue: {} },
    { provide: SystemTransactionRunner, useValue: {} },
  ],
  exports: [EventConsumers, TenantTransactionRunner, SystemTransactionRunner],
})
class KitDoubles {}

describe('MembershipsModule composition of the member event consumers', () => {
  let moduleRef: TestingModule;

  beforeEach(async () => {
    subscribe.mockReset();
    subscribe.mockResolvedValue(undefined);
    moduleRef = await Test.createTestingModule({ imports: [KitDoubles, MembershipsModule] })
      .setLogger({ log: () => undefined, error: () => undefined, warn: () => undefined })
      .compile();
    await moduleRef.init();
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('binds the production schedule: 1 s, 5 s, 30 s, 2 min, 10 min, 30 min, then hourly, 32 deliveries', () => {
    expect(moduleRef.get(MEMBER_EVENTS_REDELIVERY)).toEqual(productionSchedule);
  });

  it('subscribes each of the three consumers with that schedule', () => {
    expect(subscribe.mock.calls.map(([registration]) => registration)).toEqual([
      expect.objectContaining({
        handler: 'project-member-joined',
        event: 'member.joined.v1',
        redelivery: productionSchedule,
      }),
      expect.objectContaining({
        handler: 'project-member-role-changed',
        event: 'member.role-changed.v1',
        redelivery: productionSchedule,
      }),
      expect.objectContaining({
        handler: 'project-member-removed',
        event: 'member.removed.v1',
        redelivery: productionSchedule,
      }),
    ]);
  });

  it('keeps retrying a failing event for more than a day before its dead letter', () => {
    const schedule: EventRedelivery = moduleRef.get(MEMBER_EVENTS_REDELIVERY);

    // 1 s + 5 s + 30 s + 2 min + 10 min + 30 min + 25 hours: 92,556 seconds.
    expect(waitBeforeDeadLetter(schedule)).toBe(92_556_000);
    expect(waitBeforeDeadLetter(schedule)).toBeGreaterThan(oneDayMs);
  });
});
