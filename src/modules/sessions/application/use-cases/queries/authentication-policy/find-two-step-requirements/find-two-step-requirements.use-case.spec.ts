import { beforeEach, describe, expect, it } from 'vitest';

import { AuthenticationPolicy } from '../../../../../domain/aggregates/authentication-policy/authentication-policy.aggregate.js';
import {
  FakeActiveMemberships,
  InMemorySessions,
} from '../../../commands/session/sessions.fixture.js';
import { CheckOrganizationAccess } from '../check-organization-access/check-organization-access.use-case.js';
import { FindTwoStepRequirements } from './find-two-step-requirements.use-case.js';

const CAMILLE_ID: string = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';
const ATELIER_NORD: string = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';
const STUDIO_SUD: string = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2e';
const MAISON_EST: string = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2d';

describe('FindTwoStepRequirements and CheckOrganizationAccess', () => {
  let store: InMemorySessions;
  let memberships: FakeActiveMemberships;

  beforeEach(() => {
    store = new InMemorySessions();
    memberships = new FakeActiveMemberships();
    memberships.join(CAMILLE_ID, {
      memberId: '019a6b10-0000-7000-8000-000000000001',
      organizationId: ATELIER_NORD,
      role: 'owner',
    });
    memberships.join(CAMILLE_ID, {
      memberId: '019a6b10-0000-7000-8000-000000000002',
      organizationId: STUDIO_SUD,
      role: 'member',
    });
    memberships.join(CAMILLE_ID, {
      memberId: '019a6b10-0000-7000-8000-000000000003',
      organizationId: MAISON_EST,
      role: 'guest',
    });
    store.policies.set(
      ATELIER_NORD,
      AuthenticationPolicy.defaultFor(ATELIER_NORD).apply({
        twoStepVerificationRequiredFor: 'admins',
      }),
    );
    store.policies.set(
      STUDIO_SUD,
      AuthenticationPolicy.defaultFor(STUDIO_SUD).apply({
        twoStepVerificationRequiredFor: 'admins',
      }),
    );
    store.policies.set(
      MAISON_EST,
      AuthenticationPolicy.defaultFor(MAISON_EST).apply({
        twoStepVerificationRequiredFor: 'everyone',
      }),
    );
  });

  it('lists the organizations whose policy requires it for the role of the account, by organization', async () => {
    await expect(
      new FindTwoStepRequirements(store, memberships).execute({ userId: CAMILLE_ID }),
    ).resolves.toEqual({
      requirements: [
        { organizationId: MAISON_EST, requiredFor: 'everyone' },
        { organizationId: ATELIER_NORD, requiredFor: 'admins' },
      ],
    });
  });

  it('lists nothing for an account without a membership', async () => {
    await expect(
      new FindTwoStepRequirements(store, memberships).execute({
        userId: '019a5f3c-0000-7000-8000-000000000099',
      }),
    ).resolves.toEqual({ requirements: [] });
  });

  it('withholds an organization from a required member until the account has two-step verification', async () => {
    const access: CheckOrganizationAccess = new CheckOrganizationAccess(store);
    const input = { organizationId: ATELIER_NORD, userId: CAMILLE_ID, role: 'owner' } as const;

    await expect(access.execute(input)).resolves.toEqual({ withheld: true });
    await expect(access.execute({ ...input, role: 'member' })).resolves.toEqual({
      withheld: false,
    });
    store.enrollments.add(CAMILLE_ID);
    await expect(access.execute(input)).resolves.toEqual({ withheld: false });
  });
});
