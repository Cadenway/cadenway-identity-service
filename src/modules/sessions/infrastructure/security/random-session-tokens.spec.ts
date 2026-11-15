import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { IssuedToken } from '../../application/ports/session-tokens.port.js';
import { RandomSessionTokens } from './random-session-tokens.js';

describe('RandomSessionTokens', () => {
  const tokens: RandomSessionTokens = new RandomSessionTokens();

  it('draws 256 random bits as 43 base64url characters, and keeps their SHA-256', () => {
    const issued: IssuedToken = tokens.issue();

    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(Buffer.from(issued.token, 'base64url')).toHaveLength(32);
    expect(issued.tokenHash).toBe(createHash('sha256').update(issued.token).digest('hex'));
    expect(tokens.issue().token).not.toBe(issued.token);
  });

  it('hashes a presented token as it was hashed when issued', () => {
    const issued: IssuedToken = tokens.issue();

    expect(tokens.hashOf(issued.token)).toBe(issued.tokenHash);
  });

  it('refuses a value that cannot be a token, without hashing it', () => {
    expect(tokens.hashOf('example-session-token')).toBeNull();
    expect(tokens.hashOf(`${'A'.repeat(42)}=`)).toBeNull();
    expect(tokens.hashOf('A'.repeat(44))).toBeNull();
  });
});
