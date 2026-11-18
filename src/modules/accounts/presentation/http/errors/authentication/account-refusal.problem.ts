import { ProblemException } from '@cadenway/nest-common';
import type { ProblemStatus } from '@cadenway/nest-common';
import type { Response } from 'express';

import { AccountRefusal } from '../../../../application/models/authentication/account-refusal.model.js';
import type { Refusal } from '../../../../application/models/authentication/refusal.model.js';

/**
 * Interface ProblemShape
 *
 * @description
 * The status, code and details a refusal answers, as `openapi/internal/identity-service.yaml`
 * declares them. The titles stay the English reason phrases of the statuses: the gateway answers
 * the French titles of `openapi/public/auth.yaml`.
 */
interface ProblemShape {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * HTTP status of the problem.
   *
   * @type {ProblemStatus}
   * @readonly
   */
  readonly status: ProblemStatus;

  /**
   * Property code
   *
   * @description
   * Stable machine code of the contract.
   *
   * @type {string}
   * @readonly
   */
  readonly code: string;

  /**
   * Property details
   *
   * @description
   * The values the gateway forwards, dates in ISO 8601.
   *
   * @type {Readonly<Record<string, unknown>> | undefined}
   * @readonly
   */
  readonly details?: Readonly<Record<string, unknown>>;

  /**
   * Property retryAt
   *
   * @description
   * When the request can succeed, for the `Retry-After` header of a 429.
   *
   * @type {Date | undefined}
   * @readonly
   */
  readonly retryAt?: Date;
  // #endregion
}

/**
 * Function shapeOf
 *
 * @description
 * Maps a refusal of a use case to its problem. A refused password or code answers 422, never 401:
 * the gateway's client turns any 401 into `503 upstream.unauthorized`.
 *
 * @param {Refusal} refusal - The refusal.
 * @returns {ProblemShape} The problem of the contract.
 */
function shapeOf(refusal: Refusal): ProblemShape {
  switch (refusal.reason) {
    case 'terms-not-accepted':
    case 'password-compromised':
    case 'code-invalid':
    case 'code-expired':
    case 'sign-up-replaced':
    case 'reset-link-expired':
    case 'email-unchanged':
      return { status: 422, code: `auth.${refusal.reason}` };
    case 'password-incorrect':
      return {
        status: 422,
        code: 'auth.password-incorrect',
        details: { remainingAttempts: refusal.remainingAttempts },
      };
    case 'reauthentication-required':
      return {
        status: 403,
        code: 'auth.reauthentication-required',
        details: { methods: ['password'] },
      };
    case 'reset-throttled':
      return {
        status: 429,
        code: 'auth.reset-throttled',
        details: { resendAvailableAt: refusal.resendAvailableAt.toISOString() },
        retryAt: refusal.resendAvailableAt,
      };
    case 'organization-owner':
      return {
        status: 409,
        code: 'account.organization-owner',
        details: { organizationIds: [...refusal.organizationIds] },
      };
    case 'session-not-found':
      return { status: 404, code: 'session.not-found' };
    case 'password-too-short':
      return {
        status: 422,
        code: 'auth.password-too-short',
        details: { minLength: refusal.minLength },
      };
    case 'invalid-credentials':
      return {
        status: 422,
        code: 'auth.invalid-credentials',
        details: { remainingAttempts: refusal.remainingAttempts },
      };
    case 'email-taken':
      return { status: 409, code: 'auth.email-taken' };
    case 'email-not-verified':
      return { status: 403, code: 'auth.email-not-verified' };
    case 'code-throttled':
      return {
        status: 429,
        code: 'auth.code-throttled',
        details: { resendAvailableAt: refusal.resendAvailableAt.toISOString() },
        retryAt: refusal.resendAvailableAt,
      };
    case 'account-locked':
      return {
        status: 429,
        code: 'auth.account-locked',
        details: { lockedUntil: refusal.lockedUntil.toISOString() },
        retryAt: refusal.lockedUntil,
      };
    case 'user-not-found':
      return { status: 404, code: 'user.not-found' };
    case 'version-mismatch':
      return {
        status: 412,
        code: 'request.version-mismatch',
        details: { version: refusal.version },
      };
  }
}

/**
 * Function answerRefusals
 *
 * @description
 * Runs a use case and turns its `AccountRefusal` into the problem of the contract; any other error
 * passes through to the `ProblemFilter` of the kit. A 429 also sets `Retry-After`, in whole seconds,
 * 1 at least, as the contract declares on `AccountLocked` and `CodeThrottled`.
 *
 * @param {Response} response - The response, for `Retry-After`.
 * @param {() => Promise<TResult>} work - The call of the use case.
 * @returns {Promise<TResult>} What the use case resolved with.
 * @throws {ProblemException} For a refusal of the use case.
 */
export async function answerRefusals<TResult>(
  response: Response,
  work: () => Promise<TResult>,
): Promise<TResult> {
  try {
    return await work();
  } catch (error) {
    if (!(error instanceof AccountRefusal)) {
      throw error;
    }
    const shape: ProblemShape = shapeOf(error.refusal);
    if (shape.retryAt !== undefined) {
      const seconds: number = Math.ceil((shape.retryAt.getTime() - Date.now()) / 1000);
      response.setHeader('Retry-After', String(Math.max(1, seconds)));
    }
    throw new ProblemException({
      status: shape.status,
      code: shape.code,
      ...(shape.details === undefined ? {} : { details: shape.details }),
    });
  }
}
