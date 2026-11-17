import { CreateApiTokenInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { describe, expect, it } from 'vitest';

import { API_TOKEN_SCOPES } from './api-token-scopes.policy.js';

describe('API_TOKEN_SCOPES', () => {
  it('are the scopes of the installed contract', () => {
    expect([...API_TOKEN_SCOPES].sort()).toEqual(
      [...CreateApiTokenInternalBody.shape.scopes.element.options].sort(),
    );
  });
});
