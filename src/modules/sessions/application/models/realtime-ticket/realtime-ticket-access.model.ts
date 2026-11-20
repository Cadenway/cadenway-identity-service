import type { ActiveMembership } from '../session/active-membership.model.js';

/** Result of a locked membership and current authentication-policy check. */
export type RealtimeTicketAccess =
  | { readonly status: 'allowed'; readonly membership: ActiveMembership }
  | { readonly status: 'unavailable' }
  | { readonly status: 'mfa-required' };
