import { beforeEach, describe, expect, it } from 'vitest';

import { ApplyMembershipChange } from '../../../commands/membership/apply-membership-change/apply-membership-change.use-case.js';
import { InMemoryMemberships } from '../../../commands/membership/memberships.fixture.js';
import { FindOwnedOrganizations } from './find-owned-organizations.use-case.js';

/**
 * Constant ATELIER_NORD
 *
 * @description
 * The organization Camille Martin created.
 *
 * @type {string}
 */
const ATELIER_NORD: string = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';

/**
 * Constant STUDIO
 *
 * @description
 * Another organization Camille Martin owns.
 *
 * @type {string}
 */
const STUDIO: string = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2a';

/**
 * Constant CAMILLE
 *
 * @description
 * Id of the account of Camille Martin.
 *
 * @type {string}
 */
const CAMILLE: string = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';

/**
 * Constant AT
 *
 * @description
 * When the events of the specs occurred.
 *
 * @type {Date}
 */
const AT: Date = new Date('2026-11-08T14:02:00Z');

describe('FindOwnedOrganizations', () => {
  let store: InMemoryMemberships;
  let apply: ApplyMembershipChange;
  let find: FindOwnedOrganizations;

  beforeEach(() => {
    store = new InMemoryMemberships();
    apply = new ApplyMembershipChange(store);
    find = new FindOwnedOrganizations(store);
  });

  it('lists the organizations whose active membership of the person is owner, sorted', async () => {
    await apply.execute({
      kind: 'joined',
      memberId: '019a6b10-0000-7000-8000-000000000001',
      organizationId: ATELIER_NORD,
      userId: CAMILLE,
      role: 'owner',
      version: 1,
      occurredAt: AT,
    });
    await apply.execute({
      kind: 'joined',
      memberId: '019a6b10-0000-7000-8000-000000000002',
      organizationId: STUDIO,
      userId: CAMILLE,
      role: 'owner',
      version: 1,
      occurredAt: AT,
    });
    await apply.execute({
      kind: 'joined',
      memberId: '019a6b10-0000-7000-8000-000000000003',
      organizationId: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2b',
      userId: CAMILLE,
      role: 'admin',
      version: 1,
      occurredAt: AT,
    });

    await expect(find.execute({ userId: CAMILLE })).resolves.toEqual({
      organizationIds: [STUDIO, ATELIER_NORD],
    });
  });

  it('leaves out a removed membership and one whose role is no longer owner', async () => {
    await apply.execute({
      kind: 'joined',
      memberId: '019a6b10-0000-7000-8000-000000000001',
      organizationId: ATELIER_NORD,
      userId: CAMILLE,
      role: 'owner',
      version: 1,
      occurredAt: AT,
    });
    await apply.execute({
      kind: 'removed',
      memberId: '019a6b10-0000-7000-8000-000000000001',
      organizationId: ATELIER_NORD,
      userId: CAMILLE,
      role: 'owner',
      version: 2,
      occurredAt: AT,
    });
    await apply.execute({
      kind: 'joined',
      memberId: '019a6b10-0000-7000-8000-000000000002',
      organizationId: STUDIO,
      userId: CAMILLE,
      role: 'owner',
      version: 1,
      occurredAt: AT,
    });
    await apply.execute({
      kind: 'role-changed',
      memberId: '019a6b10-0000-7000-8000-000000000002',
      organizationId: STUDIO,
      userId: CAMILLE,
      role: 'admin',
      version: 2,
      occurredAt: AT,
    });

    await expect(find.execute({ userId: CAMILLE })).resolves.toEqual({ organizationIds: [] });
  });
});
