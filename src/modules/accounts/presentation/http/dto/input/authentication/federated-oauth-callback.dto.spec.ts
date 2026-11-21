import { ZodValidationPipe } from '@cadenway/nest-common';
import { describe, expect, it } from 'vitest';

import { FederatedOauthCallbackDto } from './federated-oauth-callback.dto.js';

describe('federated OAuth callback validation', () => {
  const pipe = new ZodValidationPipe();
  const callback = {
    provider: 'google',
    state: 's'.repeat(43),
    browserBinding: 'b'.repeat(43),
    response: { outcome: 'authorized', code: 'code' },
  };
  const metadata = { type: 'body' as const, metatype: FederatedOauthCallbackDto };

  it('accepts the authorized and denied variants', () => {
    expect(pipe.transform(callback, metadata)).toEqual(callback);
    const denied = { ...callback, response: { outcome: 'denied', error: 'access_denied' } };
    expect(pipe.transform(denied, metadata)).toEqual(denied);
  });

  it('rejects mixed outcomes and unknown nested fields before the flow is claimed', () => {
    expect(() =>
      pipe.transform(
        { ...callback, response: { ...callback.response, error: 'denied' } },
        metadata,
      ),
    ).toThrow();
    expect(() =>
      pipe.transform({ ...callback, response: { ...callback.response, extra: true } }, metadata),
    ).toThrow();
  });
});
