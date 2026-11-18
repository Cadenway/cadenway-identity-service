import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { IssuedResetToken } from '../../../application/models/password-reset/issued-reset-token.model.js';
import { RandomResetLinkSecrets } from './random-reset-link-secrets.adapter.js';

describe('RandomResetLinkSecrets', () => {
  const secrets: RandomResetLinkSecrets = new RandomResetLinkSecrets();

  it('draws a token of 256 bits in base64url, which the event pattern accepts', () => {
    const issued: IssuedResetToken = secrets.issue();

    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{32,128}$/u);
    expect(Buffer.from(issued.token, 'base64url')).toHaveLength(32);
  });

  it('keeps only the SHA-256 of the token, in hexadecimal', () => {
    const issued: IssuedResetToken = secrets.issue();

    expect(issued.tokenHash).toBe(createHash('sha256').update(issued.token).digest('hex'));
    expect(issued.tokenHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(issued.tokenHash).not.toContain(issued.token);
  });

  it('draws a different token each time', () => {
    const tokens = new Set<string>(Array.from({ length: 50 }, (): string => secrets.issue().token));

    expect(tokens.size).toBe(50);
  });

  it('hashes a token sent back as it was hashed when drawn', () => {
    const issued: IssuedResetToken = secrets.issue();

    expect(secrets.hashOf(issued.token)).toBe(issued.tokenHash);
  });

  it('refuses a malformed token without hashing it', () => {
    for (const token of ['', 'short', `${'A'.repeat(42)}=`, 'A'.repeat(44), `${'A'.repeat(42)}+`]) {
      expect(secrets.hashOf(token)).toBeNull();
    }
  });
});
