import { decodeCursor, encodeCursor, ProblemException } from '@cadenway/nest-common';
import type { CursorPosition } from '@cadenway/nest-common';

import type { ApiTokenPosition } from '../../../../application/models/api-token/api-token-position.model.js';

/**
 * Constant LIST_FILTERS
 *
 * @description
 * What defines the list of tokens, fingerprinted into its cursor: the sort only, since the user and
 * the organization come from the internal token and the cursor never widens them.
 *
 * @type {{ readonly sort: '-createdAt' }}
 */
const LIST_FILTERS: { readonly sort: '-createdAt' } = { sort: '-createdAt' };

/**
 * Constant UUID
 *
 * @description
 * The shape of a token id: the cursor is not signed, so its id is checked before it reaches SQL.
 *
 * @type {RegExp}
 */
const UUID: RegExp = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * Function toCursor
 *
 * @description
 * Encodes where the next page of tokens starts as the opaque cursor of the kit.
 *
 * @param {ApiTokenPosition | null} position - Where the next page starts, or `null`.
 * @returns {string | null} The cursor, or `null` on the last page.
 */
export function toCursor(position: ApiTokenPosition | null): string | null {
  return position === null
    ? null
    : encodeCursor({ sort: [position.createdAt.toISOString()], id: position.id }, LIST_FILTERS);
}

/**
 * Function toPosition
 *
 * @description
 * Decodes the cursor of a previous page. A cursor that is not one of this list answers
 * `400 request.invalid` with one issue on `cursor` (`invalid_cursor`), the code the contract
 * declares for a query that does not match it: `decodeCursor` of the kit answers it for a malformed
 * cursor or one issued for another sort, and this function answers the same for a decoded position
 * that does not name a creation instant and a token id.
 *
 * @param {string | undefined} cursor - The `cursor` query parameter.
 * @returns {ApiTokenPosition | null} Where the page starts, or `null` for the first page.
 * @throws {ProblemException} `400 request.invalid` for a cursor that is not one of this list.
 */
export function toPosition(cursor: string | undefined): ApiTokenPosition | null {
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
  const createdAt: unknown = position.sort[0];
  if (position.sort.length !== 1 || typeof createdAt !== 'string') {
    throw invalid;
  }
  const instant: Date = new Date(createdAt);
  if (Number.isNaN(instant.getTime()) || !UUID.test(position.id)) {
    throw invalid;
  }
  return { createdAt: instant, id: position.id };
}
