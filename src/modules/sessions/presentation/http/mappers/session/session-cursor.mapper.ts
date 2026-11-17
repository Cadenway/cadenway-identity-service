import { decodeCursor, encodeCursor, ProblemException } from '@cadenway/nest-common';
import type { CursorPosition } from '@cadenway/nest-common';

import type { SessionPosition } from '../../../../application/models/session/session-position.model.js';

/**
 * Constant LIST_FILTERS
 *
 * @description
 * What defines the list of the sessions, fingerprinted in its cursors: its sort.
 *
 * @type {{ readonly sort: '-signedInAt' }}
 */
const LIST_FILTERS: { readonly sort: '-signedInAt' } = { sort: '-signedInAt' };

/**
 * Constant UUID
 *
 * @description
 * The form of a session id.
 *
 * @type {RegExp}
 */
const UUID: RegExp = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * Function isSignInInstant
 *
 * @description
 * Whether a decoded sort value is an instant this list writes: the form `toISOString` gives, in
 * the years PostgreSQL accepts.
 *
 * @param {string} signedInAt - The decoded value.
 * @param {Date} instant - The value as a date.
 * @returns {boolean} `true` for an instant of this list.
 */
function isSignInInstant(signedInAt: string, instant: Date): boolean {
  if (Number.isNaN(instant.getTime())) {
    return false;
  }
  const year: number = instant.getUTCFullYear();
  return year >= 1970 && year <= 9999 && instant.toISOString() === signedInAt;
}

/**
 * Function toSessionCursor
 *
 * @description
 * The `nextCursor` of a page of the sessions.
 *
 * @param {SessionPosition | null} position - Where the next page starts, or `null`.
 * @returns {string | null} The opaque cursor, or `null` on the last page.
 */
export function toSessionCursor(position: SessionPosition | null): string | null {
  return position === null
    ? null
    : encodeCursor({ sort: [position.signedInAt.toISOString()], id: position.id }, LIST_FILTERS);
}

/**
 * Function toSessionPosition
 *
 * @description
 * Reads the cursor of a request: a malformed cursor, one of another list, and a decoded position
 * this list never writes answer `400 request.invalid` with one issue on `cursor`.
 *
 * @param {string | undefined} cursor - The cursor, or `undefined` for the first page.
 * @returns {SessionPosition | null} The position, or `null` for the first page.
 * @throws {ProblemException} `400 request.invalid`.
 */
export function toSessionPosition(cursor: string | undefined): SessionPosition | null {
  if (cursor === undefined) {
    return null;
  }
  const position: CursorPosition = decodeCursor(cursor, LIST_FILTERS);
  const invalid: ProblemException = new ProblemException({
    status: 400,
    code: 'request.invalid',
    detail: 'The request does not match its contract.',
    details: {
      issues: [
        {
          in: 'query',
          path: 'cursor',
          code: 'invalid_cursor',
          message: 'Expected the nextCursor of a previous page of this list.',
        },
      ],
    },
  });
  const signedInAt: unknown = position.sort[0];
  if (position.sort.length !== 1 || typeof signedInAt !== 'string') {
    throw invalid;
  }
  const instant: Date = new Date(signedInAt);
  if (!isSignInInstant(signedInAt, instant) || !UUID.test(position.id)) {
    throw invalid;
  }
  return { signedInAt: instant, id: position.id };
}
