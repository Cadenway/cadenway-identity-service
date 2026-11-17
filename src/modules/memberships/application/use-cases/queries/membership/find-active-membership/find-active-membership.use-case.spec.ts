import { beforeEach, describe, expect, it } from 'vitest';

import { ApplyMembershipChange } from '../../../commands/membership/apply-membership-change/apply-membership-change.use-case.js';
import { InMemoryMemberships } from '../../../commands/membership/memberships.fixture.js';
import { FindActiveMembership } from './find-active-membership.use-case.js';

const ATELIER_NORD = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';
const CAMILLE = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';
const FIRST = '019a6b10-0000-7000-8000-000000000001';
const SECOND = '019a6b10-0000-7000-8000-000000000002';
const AT = new Date('2026-11-08T14:02:00Z');

describe('FindActiveMembership', () => {
  let store: InMemoryMemberships;
  let apply: ApplyMembershipChange;
  let find: FindActiveMembership;

  beforeEach(() => {
    store = new InMemoryMemberships();
    apply = new ApplyMembershipChange(store);
    find = new FindActiveMembership(store);
  });

  it('answers the membership and the role of a member', async () => {
    await apply.execute({
      kind: 'joined',
      memberId: FIRST,
      organizationId: ATELIER_NORD,
      userId: CAMILLE,
      role: 'admin',
      version: 1,
      occurredAt: AT,
    });

    await expect(find.execute({ organizationId: ATELIER_NORD, userId: CAMILLE })).resolves.toEqual({
      memberId: FIRST,
      organizationId: ATELIER_NORD,
      userId: CAMILLE,
      role: 'admin',
    });
  });

  it('answers null for an account that is not a member, or no longer one', async () => {
    await expect(
      find.execute({ organizationId: ATELIER_NORD, userId: CAMILLE }),
    ).resolves.toBeNull();

    await apply.execute({
      kind: 'removed',
      memberId: FIRST,
      organizationId: ATELIER_NORD,
      userId: CAMILLE,
      role: 'member',
      version: 2,
      occurredAt: AT,
    });
    await expect(
      find.execute({ organizationId: ATELIER_NORD, userId: CAMILLE }),
    ).resolves.toBeNull();
  });

  it('answers the new membership of a person who joined again after a removal', async () => {
    const base = { organizationId: ATELIER_NORD, userId: CAMILLE, occurredAt: AT } as const;
    await apply.execute({ ...base, kind: 'joined', memberId: FIRST, role: 'member', version: 1 });
    await apply.execute({ ...base, kind: 'removed', memberId: FIRST, role: 'member', version: 2 });
    await apply.execute({ ...base, kind: 'joined', memberId: SECOND, role: 'guest', version: 1 });

    await expect(find.execute({ organizationId: ATELIER_NORD, userId: CAMILLE })).resolves.toEqual({
      memberId: SECOND,
      organizationId: ATELIER_NORD,
      userId: CAMILLE,
      role: 'guest',
    });
  });
});
