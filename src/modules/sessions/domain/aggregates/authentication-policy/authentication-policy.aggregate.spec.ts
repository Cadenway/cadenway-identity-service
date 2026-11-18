import { describe, expect, it } from 'vitest';

import { InvalidAuthenticationPolicyError } from '../../errors/authentication-policy/invalid-authentication-policy.error.js';
import { AuthenticationPolicy } from './authentication-policy.aggregate.js';

const ATELIER_NORD: string = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';

describe('AuthenticationPolicy', () => {
  it('starts with nobody required, 12 hours of inactivity and version 1', () => {
    expect(AuthenticationPolicy.defaultFor(ATELIER_NORD).snapshot).toEqual({
      organizationId: ATELIER_NORD,
      twoStepVerificationRequiredFor: 'nobody',
      sessionInactivityTimeoutMinutes: 720,
      version: 1,
    });
  });

  it('requires two-step verification of the owner and admins only for admins', () => {
    const admins: AuthenticationPolicy = AuthenticationPolicy.defaultFor(ATELIER_NORD).apply({
      twoStepVerificationRequiredFor: 'admins',
    });

    expect(admins.requiresTwoStepFor('owner')).toBe(true);
    expect(admins.requiresTwoStepFor('admin')).toBe(true);
    expect(admins.requiresTwoStepFor('member')).toBe(false);
    expect(admins.requiresTwoStepFor('guest')).toBe(false);
  });

  it('requires it of every role, guests included, for everyone, and of none for nobody', () => {
    const everyone: AuthenticationPolicy = AuthenticationPolicy.defaultFor(ATELIER_NORD).apply({
      twoStepVerificationRequiredFor: 'everyone',
    });

    for (const role of ['owner', 'admin', 'member', 'guest'] as const) {
      expect(everyone.requiresTwoStepFor(role)).toBe(true);
      expect(AuthenticationPolicy.defaultFor(ATELIER_NORD).requiresTwoStepFor(role)).toBe(false);
    }
  });

  it('withholds the organization only from a required member without two-step verification', () => {
    const admins: AuthenticationPolicy = AuthenticationPolicy.defaultFor(ATELIER_NORD).apply({
      twoStepVerificationRequiredFor: 'admins',
    });

    expect(admins.withholds('admin', false)).toBe(true);
    expect(admins.withholds('admin', true)).toBe(false);
    expect(admins.withholds('member', false)).toBe(false);
  });

  it('takes the next version for a change and keeps it for a patch that moves nothing', () => {
    const policy: AuthenticationPolicy = AuthenticationPolicy.defaultFor(ATELIER_NORD);
    const changed: AuthenticationPolicy = policy.apply({ sessionInactivityTimeoutMinutes: 60 });

    expect(changed.snapshot).toMatchObject({ sessionInactivityTimeoutMinutes: 60, version: 2 });
    expect(changed.apply({})).toBe(changed);
    expect(changed.apply({ sessionInactivityTimeoutMinutes: 60 })).toBe(changed);
    expect(changed.apply({ twoStepVerificationRequiredFor: 'nobody' })).toBe(changed);
  });

  it('refuses an inactivity, a role group or a version outside the contract', () => {
    const policy: AuthenticationPolicy = AuthenticationPolicy.defaultFor(ATELIER_NORD);

    expect(() => policy.apply({ sessionInactivityTimeoutMinutes: 30 })).toThrow(
      InvalidAuthenticationPolicyError,
    );
    expect(() =>
      AuthenticationPolicy.restore({ ...policy.snapshot, sessionInactivityTimeoutMinutes: 1 }),
    ).toThrow(InvalidAuthenticationPolicyError);
    expect(() => AuthenticationPolicy.restore({ ...policy.snapshot, version: 0 })).toThrow(
      InvalidAuthenticationPolicyError,
    );
  });
});
