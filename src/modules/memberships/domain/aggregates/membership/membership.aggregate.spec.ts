import { describe, expect, it } from 'vitest';

import { InvalidMembershipStateError } from '../../errors/membership/invalid-membership-state.error.js';
import { MembershipMismatchError } from '../../errors/membership/membership-mismatch.error.js';
import type { MembershipChange } from '../../value-objects/membership/membership-change.value-object.js';
import { Membership } from './membership.aggregate.js';

const ATELIER_NORD = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';
const CAMILLE = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';
const MEMBER = '019a6b10-0000-7000-8000-000000000001';

/**
 * Builds an event of the membership of Camille Martin in Atelier Nord.
 *
 * @param kind - Which event.
 * @param version - Version after the change.
 * @param role - Role after the change.
 * @returns The change.
 */
function change(
  kind: MembershipChange['kind'],
  version: number,
  role: MembershipChange['role'] = 'member',
): MembershipChange {
  return {
    kind,
    memberId: MEMBER,
    organizationId: ATELIER_NORD,
    userId: CAMILLE,
    role,
    version,
    occurredAt: new Date(`2026-11-08T14:0${String(version)}:00Z`),
  };
}

describe('Membership', () => {
  it('begins active from a join, with its role and version', () => {
    const membership: Membership = Membership.begin(change('joined', 1, 'owner'));

    expect(membership.isActive).toBe(true);
    expect(membership.snapshot).toEqual({
      id: MEMBER,
      organizationId: ATELIER_NORD,
      userId: CAMILLE,
      role: 'owner',
      version: 1,
      removedAt: null,
    });
  });

  it('begins active from a role change that arrived before the join', () => {
    const membership: Membership = Membership.begin(change('role-changed', 2, 'admin'));

    expect(membership.isActive).toBe(true);
    expect(membership.apply(change('joined', 1, 'member'))).toBe(membership);
    expect(membership.snapshot.role).toBe('admin');
  });

  it('applies a newer version and ignores the same version or an older one', () => {
    const joined: Membership = Membership.begin(change('joined', 1, 'member'));
    const promoted: Membership = joined.apply(change('role-changed', 3, 'admin'));

    expect(promoted.snapshot).toMatchObject({ role: 'admin', version: 3 });
    expect(promoted.apply(change('role-changed', 2, 'guest'))).toBe(promoted);
    expect(promoted.apply(change('role-changed', 3, 'guest'))).toBe(promoted);
  });

  it('keeps a removed membership removed, whatever arrives after the removal', () => {
    const removed: Membership = Membership.begin(change('joined', 1)).apply(
      change('removed', 3, 'member'),
    );

    expect(removed.isActive).toBe(false);
    expect(removed.snapshot.removedAt).toEqual(new Date('2026-11-08T14:03:00Z'));
    expect(removed.apply(change('role-changed', 2, 'admin'))).toBe(removed);
    expect(removed.apply(change('role-changed', 4, 'admin'))).toBe(removed);
    expect(removed.apply(change('removed', 3))).toBe(removed);
  });

  it('applies a removal after a role change of a higher version, keeping that role', () => {
    const changed: Membership = Membership.begin(change('role-changed', 3, 'admin'));
    const removed: Membership = changed.apply(change('removed', 2, 'member'));

    expect(removed.isActive).toBe(false);
    expect(removed.snapshot).toMatchObject({ role: 'admin', version: 3 });
  });

  it('keeps a removal seen first, so the late join never activates it', () => {
    const removed: Membership = Membership.begin(change('removed', 2, 'guest'));

    expect(removed.isActive).toBe(false);
    expect(removed.apply(change('joined', 1, 'guest'))).toBe(removed);
  });

  it('refuses an event that names another organization or account', () => {
    const joined: Membership = Membership.begin(change('joined', 1));

    expect(() => joined.apply({ ...change('role-changed', 2), organizationId: CAMILLE })).toThrow(
      MembershipMismatchError,
    );
    expect(() => joined.apply({ ...change('removed', 2), userId: ATELIER_NORD })).toThrow(
      MembershipMismatchError,
    );
  });

  it('refuses a version that is not a positive integer', () => {
    expect(() => Membership.begin(change('joined', 0))).toThrow(InvalidMembershipStateError);
    expect(() => Membership.begin(change('joined', 1.5))).toThrow(InvalidMembershipStateError);
  });
});
