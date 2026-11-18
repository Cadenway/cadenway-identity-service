import type { SessionState } from './session-state.value-object.js';

/**
 * Type SessionStart
 *
 * @description
 * A session not stored yet: PostgreSQL assigns its id on insert, and its inactivity is read from the
 * policy of its organization with the stored row.
 *
 * @type {Omit<SessionState, 'id' | 'revokedAt' | 'inactivityTimeoutMinutes'>}
 */
export type SessionStart = Omit<SessionState, 'id' | 'revokedAt' | 'inactivityTimeoutMinutes'>;
