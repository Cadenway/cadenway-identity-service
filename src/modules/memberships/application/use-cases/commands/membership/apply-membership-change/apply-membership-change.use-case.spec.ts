import { beforeEach, describe, expect, it } from 'vitest';

import { MembershipMismatchError } from '../../../../../domain/errors/membership/membership-mismatch.error.js';
import { InMemoryMemberships } from '../memberships.fixture.js';
import type { ApplyMembershipChangeInput } from './apply-membership-change.input.js';
import { ApplyMembershipChange } from './apply-membership-change.use-case.js';

const ATELIER_NORD = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';
const CAMILLE = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';
const MEMBER = '019a6b10-0000-7000-8000-000000000001';

/**
 * Builds an event of the membership of Camille Martin in Atelier Nord.
 *
 * @param kind - Which event.
 * @param version - Version after the change.
 * @param role - Role after the change.
 * @returns The input of the use case.
 */
function event(
  kind: ApplyMembershipChangeInput['kind'],
  version: number,
  role: ApplyMembershipChangeInput['role'] = 'member',
): ApplyMembershipChangeInput {
  return {
    kind,
    memberId: MEMBER,
    organizationId: ATELIER_NORD,
    userId: CAMILLE,
    role,
    version,
    occurredAt: new Date('2026-11-08T14:02:00Z'),
  };
}

describe('ApplyMembershipChange', () => {
  let store: InMemoryMemberships;
  let apply: ApplyMembershipChange;

  beforeEach(() => {
    store = new InMemoryMemberships();
    apply = new ApplyMembershipChange(store);
  });

  it('stores a membership seen for the first time', async () => {
    await apply.execute(event('joined', 1, 'owner'));

    expect(store.rows.get(MEMBER)).toEqual({
      id: MEMBER,
      organizationId: ATELIER_NORD,
      userId: CAMILLE,
      role: 'owner',
      version: 1,
      removedAt: null,
    });
  });

  it('changes nothing for an event applied twice', async () => {
    await apply.execute(event('joined', 1));
    await apply.execute(event('role-changed', 2, 'admin'));
    await apply.execute(event('role-changed', 2, 'admin'));

    expect(store.writes).toBe(2);
    expect(store.rows.get(MEMBER)).toMatchObject({ role: 'admin', version: 2 });
  });

  it('applies the events of a membership by version, whatever their order', async () => {
    await apply.execute(event('role-changed', 3, 'guest'));
    await apply.execute(event('joined', 1, 'member'));
    await apply.execute(event('role-changed', 2, 'admin'));

    expect(store.rows.get(MEMBER)).toMatchObject({ role: 'guest', version: 3, removedAt: null });
  });

  it('keeps a removal, even when the join arrives after it', async () => {
    await apply.execute(event('removed', 2));
    await apply.execute(event('joined', 1));

    expect(store.rows.get(MEMBER)?.removedAt).toEqual(new Date('2026-11-08T14:02:00Z'));
    await expect(
      store.run((memberships) => memberships.findActive(ATELIER_NORD, CAMILLE)),
    ).resolves.toBeNull();
  });

  it('refuses an event whose membership id is stored under another organization', async () => {
    store.rows.set(MEMBER, {
      id: MEMBER,
      organizationId: CAMILLE,
      userId: CAMILLE,
      role: 'owner',
      version: 1,
      removedAt: null,
    });

    await expect(apply.execute(event('joined', 1))).rejects.toThrow(MembershipMismatchError);
    expect(store.rows.get(MEMBER)).toMatchObject({ organizationId: CAMILLE, role: 'owner' });
  });

  it('refuses an event that names another account than the stored membership', async () => {
    await apply.execute(event('joined', 1));

    await expect(
      apply.execute({ ...event('role-changed', 2), userId: ATELIER_NORD }),
    ).rejects.toThrow(MembershipMismatchError);
    expect(store.rows.get(MEMBER)).toMatchObject({ userId: CAMILLE, version: 1 });
  });
});
