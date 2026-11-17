import { ZodValidationPipe } from '@cadenway/nest-common';
import type { ArgumentMetadata } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { UpdateUserBody } from './update-user-body.dto.js';

const BODY: ArgumentMetadata = { type: 'body', metatype: UpdateUserBody };

/**
 * Validates a body as the global pipe of the kit does.
 *
 * @param value - The body.
 * @returns The parsed body.
 */
function parse(value: unknown): unknown {
  return new ZodValidationPipe().transform(value, BODY);
}

describe('UpdateUserBody', () => {
  it('keeps the members a patch gives, null clearing the display name and the job title', () => {
    expect(parse({ displayName: null, jobTitle: null, timeZone: 'Europe/Paris' })).toEqual({
      displayName: null,
      jobTitle: null,
      timeZone: 'Europe/Paris',
    });
    expect(parse({})).toEqual({});
  });

  it('refuses members of spaces only and an unknown time zone, one issue each', () => {
    let problem: unknown;
    try {
      parse({ name: '  ', displayName: ' ', jobTitle: '\t', timeZone: 'Europe/Atlantis' });
    } catch (error) {
      problem = error;
    }

    expect(problem).toMatchObject({
      problem: {
        status: 400,
        code: 'request.invalid',
        details: {
          issues: [
            expect.objectContaining({ in: 'body', path: 'name' }) as unknown,
            expect.objectContaining({ in: 'body', path: 'displayName' }) as unknown,
            expect.objectContaining({ in: 'body', path: 'jobTitle' }) as unknown,
            expect.objectContaining({ in: 'body', path: 'timeZone' }) as unknown,
          ],
        },
      },
    });
  });

  it('refuses null for the name, the time zone and the language, and an unknown language', () => {
    for (const body of [
      { name: null },
      { timeZone: null },
      { language: null },
      { language: 'it' },
    ]) {
      expect(() => parse(body)).toThrow();
    }
  });
});
