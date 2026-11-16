import type { SessionState } from './session-state.value-object.js';

/**
 * Type SessionStart
 *
 * @description
 * A session not stored yet: PostgreSQL assigns its id on insert.
 *
 * @type {Omit<SessionState, 'id' | 'revokedAt'>}
 */
export type SessionStart = Omit<SessionState, 'id' | 'revokedAt'>;
