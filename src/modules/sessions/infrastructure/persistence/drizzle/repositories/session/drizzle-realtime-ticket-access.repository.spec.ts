import type { SystemTransactionRunner } from '@cadenway/nest-common/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DrizzleRealtimeTicketAccessRepository } from './drizzle-realtime-ticket-access.repository.js';

const dependencies = vi.hoisted(() => ({
  lockPolicy: vi.fn(),
  lockEnrollment: vi.fn(),
}));

vi.mock('../authentication-policy/drizzle-authentication-policy.repository.js', () => ({
  DrizzleAuthenticationPolicyRepository: class {
    public lock = dependencies.lockPolicy;
  },
}));

vi.mock('./drizzle-two-step-enrollment.repository.js', () => ({
  DrizzleTwoStepEnrollmentRepository: class {
    public isEnrolledForUpdate = dependencies.lockEnrollment;
  },
}));

const organizationId = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';
const userId = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';
const membership = {
  memberId: '019a6b10-0000-7000-8000-00000000000a',
  organizationId,
  role: 'member' as const,
};

describe('DrizzleRealtimeTicketAccessRepository', () => {
  const lookup = { execute: vi.fn() };
  const runner = {
    run: async (work: (scope: { db: object }) => Promise<unknown>): Promise<unknown> =>
      work({ db: {} }),
  } as unknown as SystemTransactionRunner;
  const access = new DrizzleRealtimeTicketAccessRepository(runner, lookup);

  beforeEach(() => {
    vi.clearAllMocks();
    lookup.execute.mockResolvedValue(membership);
  });

  it('refuses an absent membership after locking the organization policy', async () => {
    dependencies.lockPolicy.mockResolvedValue({ requiresTwoStepFor: () => false });
    lookup.execute.mockResolvedValue(null);

    await expect(access.resolveForUpdate(organizationId, userId)).resolves.toEqual({
      status: 'unavailable',
    });
    expect(dependencies.lockPolicy).toHaveBeenCalledWith(organizationId);
    expect(lookup.execute).toHaveBeenCalledWith({ organizationId, userId });
    expect(dependencies.lockPolicy.mock.invocationCallOrder[0]).toBeLessThan(
      lookup.execute.mock.invocationCallOrder[0] ?? 0,
    );
    expect(dependencies.lockEnrollment).not.toHaveBeenCalled();
  });

  it('refuses a member whose policy requires missing two-step verification', async () => {
    dependencies.lockPolicy.mockResolvedValue({
      requiresTwoStepFor: () => true,
      withholds: (_role: string, enrolled: boolean) => !enrolled,
    });
    dependencies.lockEnrollment.mockResolvedValue(false);

    await expect(access.resolveForUpdate(organizationId, userId)).resolves.toEqual({
      status: 'mfa-required',
    });
    expect(dependencies.lockEnrollment).toHaveBeenCalledWith(userId);
  });

  it('allows an enrolled member and holds the enrollment after the membership lock', async () => {
    dependencies.lockPolicy.mockResolvedValue({
      requiresTwoStepFor: () => true,
      withholds: (_role: string, enrolled: boolean) => !enrolled,
    });
    dependencies.lockEnrollment.mockResolvedValue(true);

    await expect(access.resolveForUpdate(organizationId, userId)).resolves.toEqual({
      status: 'allowed',
      membership,
    });
    expect(lookup.execute.mock.invocationCallOrder[0]).toBeLessThan(
      dependencies.lockEnrollment.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('does not lock enrollment when the policy allows the role without it', async () => {
    dependencies.lockPolicy.mockResolvedValue({ requiresTwoStepFor: () => false });

    await expect(access.resolveForUpdate(organizationId, userId)).resolves.toEqual({
      status: 'allowed',
      membership,
    });
    expect(dependencies.lockEnrollment).not.toHaveBeenCalled();
  });
});
