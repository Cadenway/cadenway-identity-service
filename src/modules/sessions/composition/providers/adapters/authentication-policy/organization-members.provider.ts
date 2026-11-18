import type { FactoryProvider } from '@nestjs/common';

import { FindOrganizationMember } from '../../../../../memberships/public/membership/find-organization-member.js';
import type { FindOrganizationMemberOutput } from '../../../../../memberships/public/membership/find-organization-member.js';
import { ListOrganizationMembers } from '../../../../../memberships/public/membership/list-organization-members.js';
import type { ListOrganizationMembersOutput } from '../../../../../memberships/public/membership/list-organization-members.js';
import type { OrganizationMember } from '../../../../application/models/authentication-policy/organization-member.model.js';
import type { OrganizationMembers } from '../../../../application/ports/outbound/memberships/authentication-policy/organization-members.port.js';
import { ORGANIZATION_MEMBERS } from '../../../tokens/authentication-policy/organization-members.token.js';

/**
 * Constant organizationMembersProvider
 *
 * @description
 * Binds the `OrganizationMembers` port of this module to the `FindOrganizationMember` and
 * `ListOrganizationMembers` providers the memberships module exports. Both run in the tenant
 * transaction of their caller, the policy routes, and join it.
 *
 * @type {FactoryProvider<OrganizationMembers>}
 */
export const organizationMembersProvider: FactoryProvider<OrganizationMembers> = {
  provide: ORGANIZATION_MEMBERS,
  inject: [FindOrganizationMember, ListOrganizationMembers],
  useFactory: (
    findOrganizationMember: FindOrganizationMember,
    listOrganizationMembers: ListOrganizationMembers,
  ): OrganizationMembers => ({
    roleOf: async (
      organizationId: string,
      userId: string,
    ): Promise<'owner' | 'admin' | 'member' | 'guest' | null> => {
      const member: FindOrganizationMemberOutput | null = await findOrganizationMember.execute({
        organizationId,
        userId,
      });
      return member?.role ?? null;
    },
    list: async (organizationId: string): Promise<readonly OrganizationMember[]> => {
      const listed: ListOrganizationMembersOutput = await listOrganizationMembers.execute({
        organizationId,
      });
      return listed.members.map(
        (member: { readonly userId: string; readonly role: OrganizationMember['role'] }) => ({
          userId: member.userId,
          role: member.role,
        }),
      );
    },
  }),
};
