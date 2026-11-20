import type { User } from '../../../domain/aggregates/account/user.aggregate.js';
import { AccountRefusal } from '../../models/authentication/account-refusal.model.js';
import type { AvatarOwner } from '../../models/avatar/avatar-owner.model.js';
import type { AvatarStore } from '../../ports/outbound/transactions/avatar/avatar-store.port.js';

/** Locks the verified owner's account before a write or reservation lookup. */
export async function lockAvatarOwner(store: AvatarStore, input: AvatarOwner): Promise<User> {
  if (input.actorUserId.toLowerCase() !== input.userId.toLowerCase()) {
    throw new AccountRefusal({ reason: 'user-not-found' });
  }
  const user = await store.lockUser(input.userId.toLowerCase());
  if (user === null) throw new AccountRefusal({ reason: 'user-not-found' });
  return user;
}
