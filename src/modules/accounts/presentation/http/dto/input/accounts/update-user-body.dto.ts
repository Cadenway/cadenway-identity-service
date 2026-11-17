import { UpdateUserBody as UpdateUserSchema } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';
import type { z } from 'zod';

import { isIanaTimeZone } from '../../../validation/accounts/time-zone.validator.js';

/**
 * Function checkProfile
 *
 * @description
 * The checks of `ProfilePatch` the generated schema cannot express: the name, the display name and
 * the job title hold a character other than a space once trimmed, and the time zone is an IANA
 * name this service knows. Each failure is one issue on its member.
 *
 * @param {z.infer<typeof UpdateUserSchema>} body - The parsed patch.
 * @param {z.RefinementCtx} context - Where the issues are added.
 */
function checkProfile(body: z.infer<typeof UpdateUserSchema>, context: z.RefinementCtx): void {
  const texts: readonly ['name' | 'displayName' | 'jobTitle', string | null | undefined][] = [
    ['name', body.name],
    ['displayName', body.displayName],
    ['jobTitle', body.jobTitle],
  ];
  for (const [member, value] of texts) {
    if (typeof value === 'string' && value.trim() === '') {
      context.addIssue({
        code: 'custom',
        path: [member],
        message: 'Expected a value with a character other than a space',
      });
    }
  }
  if (body.timeZone !== undefined && !isIanaTimeZone(body.timeZone)) {
    context.addIssue({
      code: 'custom',
      path: ['timeZone'],
      message: 'Expected an IANA time zone name',
    });
  }
}

/**
 * Class UpdateUserBody
 *
 * @description
 * Body of `PATCH /internal/v1/users/{userId}`, a JSON Merge Patch (`ProfilePatch`), validated with
 * the schema of the contract and `checkProfile`: `400 request.invalid` with one issue per refused
 * member, never echoing a value. A member left out stays absent; `null` clears `displayName` or
 * `jobTitle` and is refused for the others.
 */
export class UpdateUserBody extends zodDto(UpdateUserSchema.superRefine(checkProfile)) {}
