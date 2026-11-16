import { describe, expect, it } from 'vitest';

import { PasswordTooShortError } from '../../errors/password/password-too-short.error.js';
import { assertAcceptablePassword, PASSWORD_MIN_LENGTH } from './password.policy.js';

describe('password policy', () => {
  it('accepts 12 characters without any composition rule', () => {
    expect(() => {
      assertAcceptablePassword('aaaabbbbcccc');
    }).not.toThrow();
    expect(() => {
      assertAcceptablePassword('atelier nord');
    }).not.toThrow();
  });

  it('refuses 11 characters, with the minimum length', () => {
    try {
      assertAcceptablePassword('atelier-nor');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PasswordTooShortError);
      expect((error as PasswordTooShortError).minLength).toBe(PASSWORD_MIN_LENGTH);
      expect((error as Error).message).not.toContain('atelier');
    }
  });

  it('counts Unicode code points, not UTF-16 units', () => {
    const elevenEmoji: string = '\u{1F512}'.repeat(11);
    const twelveAccented: string = 'é'.repeat(12);

    expect(elevenEmoji.length).toBe(22);
    expect(() => {
      assertAcceptablePassword(elevenEmoji);
    }).toThrow(PasswordTooShortError);
    expect(() => {
      assertAcceptablePassword(twelveAccented);
    }).not.toThrow();
  });
});
