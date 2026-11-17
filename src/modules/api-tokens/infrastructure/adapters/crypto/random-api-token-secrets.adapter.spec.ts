import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { RandomApiTokenSecrets } from './random-api-token-secrets.adapter.js';

describe('RandomApiTokenSecrets', () => {
  const secrets = new RandomApiTokenSecrets();

  it('draws a secret of the contract format, with its 11-character prefix and its SHA-256', () => {
    const issued = secrets.issue();

    expect(issued.secret).toMatch(/^cw_pat_[0-9A-Za-z]{36}$/u);
    expect(issued.prefix).toBe(issued.secret.slice(0, 11));
    expect(issued.prefix).toMatch(/^cw_pat_[0-9A-Za-z]{4}$/u);
    expect(issued.tokenHash).toBe(createHash('sha256').update(issued.secret).digest('hex'));
    expect(issued.tokenHash).not.toContain(issued.secret);
  });

  it('draws a different secret each time', () => {
    const drawn = new Set(Array.from({ length: 200 }, () => secrets.issue().secret));

    expect(drawn.size).toBe(200);
  });

  it('hashes a secret it drew, and refuses one whose check characters do not match', () => {
    const { secret, tokenHash } = secrets.issue();
    const last = secret.at(-1) === '0' ? '1' : '0';

    expect(secrets.hashOf(secret)).toBe(tokenHash);
    expect(secrets.hashOf(`${secret.slice(0, -1)}${last}`)).toBeNull();
  });

  it('refuses a value of another format, a session token included', () => {
    expect(secrets.hashOf('')).toBeNull();
    expect(secrets.hashOf('cw_pat_tooShort')).toBeNull();
    expect(secrets.hashOf('U'.repeat(43))).toBeNull();
    expect(secrets.hashOf(`cw_pat_${'a'.repeat(35)}-`)).toBeNull();
  });
});
