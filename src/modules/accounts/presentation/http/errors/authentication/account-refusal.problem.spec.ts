import { ProblemException } from '@cadenway/nest-common';
import type { Response } from 'express';
import { describe, expect, it } from 'vitest';

import { AccountRefusal } from '../../../../application/models/authentication/account-refusal.model.js';
import type { Refusal } from '../../../../application/models/authentication/refusal.model.js';
import { answerRefusals } from './account-refusal.problem.js';

/**
 * Interface FakeResponse
 *
 * @description
 * The part of an Express response the mapping writes.
 */
interface FakeResponse {
  // #region Properties
  /**
   * Property headers
   *
   * @description
   * Headers set.
   *
   * @type {Record<string, string>}
   * @readonly
   */
  readonly headers: Record<string, string>;
  // #endregion

  // #region Methods
  /**
   * Method setHeader
   *
   * @description
   * Records a header.
   *
   * @param {string} name - Its name.
   * @param {string} value - Its value.
   */
  setHeader(name: string, value: string): void;
  // #endregion
}

/**
 * Function fakeResponse
 *
 * @description
 * A response that records its headers.
 *
 * @returns {FakeResponse} The response.
 */
function fakeResponse(): FakeResponse {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader: (name: string, value: string): void => {
      headers[name] = value;
    },
  };
}

/**
 * Function problemOf
 *
 * @description
 * The problem a refusal answers, and the response it wrote.
 *
 * @param {Refusal} refusal - The refusal.
 * @returns {Promise<{ readonly problem: unknown; readonly response: FakeResponse }>} The problem.
 */
async function problemOf(
  refusal: Refusal,
): Promise<{ readonly problem: unknown; readonly response: FakeResponse }> {
  const response: FakeResponse = fakeResponse();
  try {
    await answerRefusals(response as unknown as Response, () =>
      Promise.reject(new AccountRefusal(refusal)),
    );
  } catch (error) {
    expect(error).toBeInstanceOf(ProblemException);
    return { problem: (error as ProblemException).problem, response };
  }
  throw new Error('The refusal was not mapped.');
}

describe('answerRefusals', () => {
  it('answers each refusal with the status and code of the contract', async () => {
    const expected: readonly [Refusal, number, string][] = [
      [{ reason: 'terms-not-accepted' }, 422, 'auth.terms-not-accepted'],
      [{ reason: 'password-compromised' }, 422, 'auth.password-compromised'],
      [{ reason: 'code-invalid' }, 422, 'auth.code-invalid'],
      [{ reason: 'code-expired' }, 422, 'auth.code-expired'],
      [{ reason: 'sign-up-replaced' }, 422, 'auth.sign-up-replaced'],
      [{ reason: 'email-taken' }, 409, 'auth.email-taken'],
      [{ reason: 'email-not-verified' }, 403, 'auth.email-not-verified'],
      [{ reason: 'user-not-found' }, 404, 'user.not-found'],
    ];

    for (const [refusal, status, code] of expected) {
      expect((await problemOf(refusal)).problem).toMatchObject({ status, code });
    }
  });

  it('answers a replaced sign-up with the English title of its status and no details', async () => {
    expect((await problemOf({ reason: 'sign-up-replaced' })).problem).toEqual({
      type: 'about:blank',
      title: 'Unprocessable Content',
      status: 422,
      code: 'auth.sign-up-replaced',
    });
  });

  it('carries the details the gateway formats its lines from', async () => {
    expect((await problemOf({ reason: 'password-too-short', minLength: 12 })).problem).toEqual({
      type: 'about:blank',
      title: 'Unprocessable Content',
      status: 422,
      code: 'auth.password-too-short',
      details: { minLength: 12 },
    });
    expect(
      (await problemOf({ reason: 'invalid-credentials', remainingAttempts: 3 })).problem,
    ).toMatchObject({ status: 422, details: { remainingAttempts: 3 } });
  });

  it('sets Retry-After on a 429, in whole seconds and 1 at least', async () => {
    const lockedUntil: Date = new Date(Date.now() + 15 * 60_000);
    const locked: { readonly problem: unknown; readonly response: FakeResponse } = await problemOf({
      reason: 'account-locked',
      lockedUntil,
    });
    const throttled: { readonly problem: unknown; readonly response: FakeResponse } =
      await problemOf({ reason: 'code-throttled', resendAvailableAt: new Date(Date.now() - 1000) });

    expect(locked.problem).toMatchObject({
      status: 429,
      code: 'auth.account-locked',
      details: { lockedUntil: lockedUntil.toISOString() },
    });
    expect(Number(locked.response.headers['Retry-After'])).toBeGreaterThan(899);
    expect(throttled.problem).toMatchObject({ status: 429, code: 'auth.code-throttled' });
    expect(throttled.response.headers['Retry-After']).toBe('1');
  });

  it('lets any other error through', async () => {
    const failure: Error = new Error('database unreachable');

    await expect(
      answerRefusals(fakeResponse() as unknown as Response, () => Promise.reject(failure)),
    ).rejects.toBe(failure);
  });
});
