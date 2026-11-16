import type { UserState } from './user-state.aggregate.js';

/**
 * Type UserRegistration
 *
 * @description
 * An account not stored yet: PostgreSQL assigns its id on insert.
 *
 * @type {Omit<UserState, 'id' | 'emailVerifiedAt'>}
 */
export type UserRegistration = Omit<UserState, 'id' | 'emailVerifiedAt'>;
