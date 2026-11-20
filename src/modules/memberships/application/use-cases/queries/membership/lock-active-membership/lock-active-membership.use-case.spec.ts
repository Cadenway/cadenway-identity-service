import { describe, expect, it, vi } from 'vitest';

import type { MembershipRepository } from '../../../../ports/outbound/persistence/membership/membership-repository.port.js';
import type { MembershipsUnitOfWork } from '../../../../ports/outbound/transactions/membership/memberships-unit-of-work.port.js';
import { ApplyMembershipChange } from '../../../commands/membership/apply-membership-change/apply-membership-change.use-case.js';
import { InMemoryMemberships } from '../../../commands/membership/memberships.fixture.js';
import { LockActiveMembership } from './lock-active-membership.use-case.js';

const organizationId = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';
const userId = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';
const memberId = '019a6b10-0000-7000-8000-000000000001';

describe('LockActiveMembership', () => {
  it('uses the locked read in its caller transaction and returns the active membership', async () => {
    const store = new InMemoryMemberships();
    await new ApplyMembershipChange(store).execute({
      kind: 'joined',
      memberId,
      organizationId,
      userId,
      role: 'admin',
      version: 1,
      occurredAt: new Date('2026-11-08T14:02:00Z'),
    });
    const lockedRead = vi.fn();
    const work: MembershipsUnitOfWork = {
      run: <T>(operation: (repository: MembershipRepository) => Promise<T>): Promise<T> =>
        store.run((repository) => {
          lockedRead.mockImplementation((organization: string, user: string) =>
            repository.lockActive(organization, user),
          );
          return operation({ ...repository, lockActive: lockedRead });
        }),
    };

    await expect(
      new LockActiveMembership(work).execute({ organizationId, userId }),
    ).resolves.toEqual({
      memberId,
      organizationId,
      userId,
      role: 'admin',
    });
    expect(lockedRead).toHaveBeenCalledExactlyOnceWith(organizationId, userId);
  });

  it('returns null when the projection does not contain an active membership', async () => {
    const find = new LockActiveMembership(new InMemoryMemberships());
    await expect(find.execute({ organizationId, userId })).resolves.toBeNull();
  });
});
