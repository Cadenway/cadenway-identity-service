import { encodeCursor, ProblemException } from '@cadenway/nest-common';
import type { CursorValue } from '@cadenway/nest-common';
import { describe, expect, it } from 'vitest';

import { toCursor, toPosition } from './api-token-cursor.mapper.js';

/** The token of Camille Martin the page starts after. */
const position = {
  createdAt: new Date('2026-11-08T14:02:00.123Z'),
  id: '019a6c21-4f3e-7b2a-9c1d-8e5f3a7b2c90',
} as const;

/** The answer to a cursor that is not one of this list, whoever raises it. */
const invalidCursor = {
  status: 400,
  code: 'request.invalid',
  details: { issues: [{ in: 'query', path: 'cursor', code: 'invalid_cursor' }] },
} as const;

/**
 * Reads a cursor and returns the problem it answers.
 *
 * @param cursor - The cursor.
 * @returns The body of the problem.
 */
function refusalOf(cursor: string): unknown {
  try {
    toPosition(cursor);
  } catch (error) {
    if (error instanceof ProblemException) {
      return { ...error.problem, status: error.getStatus() };
    }
    throw error;
  }
  throw new Error('The cursor was accepted.');
}

/**
 * Encodes a position as the kit does for this list, whatever it holds.
 *
 * @param sort - The sort values of the position.
 * @param id - The id of the position.
 * @returns The cursor.
 */
function forged(sort: readonly CursorValue[], id: string): string {
  return encodeCursor({ sort, id }, { sort: '-createdAt' });
}

describe('the cursor of the API token list', () => {
  it('reads back the position it wrote, and none without a cursor', () => {
    const cursor = toCursor(position);

    expect(cursor).toEqual(expect.any(String));
    expect(toPosition(cursor ?? '')).toEqual(position);
    expect(toPosition(undefined)).toBeNull();
    expect(toCursor(null)).toBeNull();
  });

  it('refuses a malformed cursor or one of another list with the code of the contract', () => {
    const otherList = encodeCursor(
      { sort: [position.createdAt.toISOString()], id: position.id },
      { sort: 'name' },
    );

    expect(refusalOf('not-a-cursor')).toMatchObject(invalidCursor);
    expect(refusalOf(otherList)).toMatchObject(invalidCursor);
  });

  it('refuses a position this list never writes, before it reaches SQL', () => {
    for (const cursor of [
      forged(['yesterday'], position.id),
      forged(['+010000-01-01T00:00:00.000Z'], position.id),
      forged(['1969-12-31T23:59:59.999Z'], position.id),
      forged(['2026-11-08T14:02:00Z'], position.id),
      forged([position.createdAt.toISOString(), 'extra'], position.id),
      forged([42], position.id),
      forged([position.createdAt.toISOString()], 'x'),
    ]) {
      expect(refusalOf(cursor)).toMatchObject(invalidCursor);
    }
  });
});
