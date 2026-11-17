import { CreateApiTokenInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { describe, expect, it } from 'vitest';

import { SESSION_SCOPES } from './session-scopes.policy.js';

describe('SESSION_SCOPES', () => {
  it('holds every scope a personal API token can be given in the installed contract', () => {
    expect([...SESSION_SCOPES].sort()).toEqual(
      [...CreateApiTokenInternalBody.shape.scopes.element.options].sort(),
    );
  });

  it('cannot be changed at run time', () => {
    expect(Object.isFrozen(SESSION_SCOPES)).toBe(true);
  });
});
