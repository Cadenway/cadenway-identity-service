/**
 * Type SessionAuthentication
 *
 * @description
 * What the sessions module says of the session of a request of the person: `recent` when its
 * person proved who they are in the last 10 minutes, `stale` when the session is open without it,
 * `not-found` when it is not an open session of the person (`404 session.not-found`).
 *
 * @type {'recent' | 'stale' | 'not-found'}
 */
export type SessionAuthentication = 'recent' | 'stale' | 'not-found';
